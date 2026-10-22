using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Presentation.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Controllers;

[Authorize]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class MedDataController : Controller
{
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;
    private readonly ILogger<MedDataController> logger;

    public MedDataController(IMedDataRepository medDataRepository, UserManager<User> userManager, ILogger<MedDataController> logger)
    {
        this.medDataRepository = medDataRepository;
        this.userManager = userManager;
        this.logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "Professional")]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> ProcessAnnotatedMedData([FromBody] AnnotatedMedDataDto? dto)
    {
        if (!ModelState.IsValid || dto == null || dto.Id <= 0)
            return BadRequest(new { success = false, message = "Invalid annotation payload." });
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized(new { success = false, message = "Your session has ended. Sign in again." });

        try
        {
            // Image and researcher metadata always come from the database, never the browser.
            var result = await medDataRepository.SaveProfessionalAsync(user, new AnnotatedMedData
            {
                MedDataId = dto.Id,
                BoxCoordinates = dto.BoxCoordinates,
                ExtractedKeyword = dto.ExtractedKeyword,
                Timestamps = dto.Timestamps,
                PressedButton = dto.PressedButton,
                Comment = dto.Comment
            });
            return SaveResult(result);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Annotation save failed for image {MedDataId} and user {UserId}.", dto.Id, user.Id);
            return StatusCode(503, new { success = false, message = "The annotation could not be saved. Keep this page open and retry." });
        }
    }

    [HttpPut]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> NextImage([FromQuery] int medDataId)
    {
        if (medDataId <= 0) return BadRequest(new { success = false, message = "Invalid image id." });
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized(new { success = false, message = "Your session has ended. Sign in again." });
        try { return SaveResult(await medDataRepository.CompleteProfessionalAsync(medDataId, user)); }
        catch (Exception exception)
        {
            logger.LogError(exception, "Completing image {MedDataId} failed for user {UserId}.", medDataId, user.Id);
            return StatusCode(503, new { success = false, message = "Completion could not be confirmed. Keep this page open and retry." });
        }
    }

    [HttpGet]
    [Authorize(Roles = "Professional")]
    public async Task<IActionResult> CurrentAnnotations([FromQuery] int medDataId)
    {
        if (medDataId <= 0) return BadRequest(new { success = false, message = "Invalid image id." });
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized(new { success = false });
        var annotations = await medDataRepository.GetProfessionalAnnotationsAsync(medDataId, user);
        if (annotations == null) return StatusCode(403, new { success = false, message = "This image is not assigned to you." });
        return Json(new
        {
            success = true,
            annotations = annotations.Select(item => new { item.ExtractedKeyword, item.PressedButton, item.BoxCoordinates, item.Comment })
        });
    }

    [HttpPost]
    [Authorize(Roles = "Medical_Student")]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> SubmitStudentAnnotations([FromBody] StudentAnnotationList? annotationList)
    {
        if (!ModelState.IsValid || annotationList?.Annotations == null)
            return BadRequest(new { success = false, message = "Invalid annotation payload." });
        var annotations = annotationList.Annotations.ToList();
        if (annotations.Count == 0 || annotations.Any(item => item == null || item.Id <= 0))
            return BadRequest(new { success = false, message = "Add at least one valid annotation." });
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized(new { success = false, message = "Your session has ended. Sign in again." });
        try
        {
            var result = await medDataRepository.SaveStudentAsync(user, annotations.Select(dto => new AnnotatedByStudentsMedData
            {
                MedDataId = dto.Id, Coordinates = dto.Coordinates, TextualAnnotation = dto.TextualAnnotation
            }).ToList());
            return result.Success ? Json(new { success = true, redirectUrl = "/Home/Student" }) : SaveResult(result);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Student annotation save failed for user {UserId}.", user.Id);
            return StatusCode(503, new { success = false, message = "The annotations could not be saved. Keep this page open and retry." });
        }
    }

    private IActionResult SaveResult(AnnotationSaveResult result) => result.Success
        ? Json(new { success = true })
        : StatusCode(result.Conflict ? 409 : 400, new { success = false, message = result.Message });
}
