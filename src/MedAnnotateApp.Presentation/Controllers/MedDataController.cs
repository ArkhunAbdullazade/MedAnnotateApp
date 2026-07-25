using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Repositories;
using MedAnnotateApp.Presentation.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace MedAnnotateApp.Presentation.Controllers;

[Authorize]
public class MedDataController : Controller
{
    private readonly IAnnotatedMedDataRepository annotatedMedDataRepository;
    private readonly IAnnotatedByStudentsMedDataRepository annotatedByStudentsMedDataRepository;
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;
    private readonly ILogger<MedDataController> logger;

    public MedDataController(
        IAnnotatedMedDataRepository annotatedMedDataRepository,
        IAnnotatedByStudentsMedDataRepository annotatedByStudentsMedDataRepository,
        IMedDataRepository medDataRepository,
        UserManager<User> userManager,
        ILogger<MedDataController> logger)
    {
        this.annotatedMedDataRepository = annotatedMedDataRepository;
        this.annotatedByStudentsMedDataRepository = annotatedByStudentsMedDataRepository;
        this.medDataRepository = medDataRepository;
        this.userManager = userManager;
        this.logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> ProcessAnnotatedMedData([FromBody] AnnotatedMedDataDto annotatedMedDataDto)
    {
        var user = await userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized(new { success = false, message = "User not found." });
        }

        var newAnnotatedMedData = new AnnotatedMedData
        {
            MedDataId = annotatedMedDataDto.Id,
            ImageUrl = annotatedMedDataDto.ImageUrl,
            ImageDescription = annotatedMedDataDto.ImageDescription,
            Sex = annotatedMedDataDto.Sex,
            Age = annotatedMedDataDto.Age,
            SkinTone = annotatedMedDataDto.SkinTone,
            BodyRegion = annotatedMedDataDto.BodyRegion,
            Diagnosis = annotatedMedDataDto.Diagnosis,
            TreatmentName = annotatedMedDataDto.TreatmentName,
            Speciality = annotatedMedDataDto.Speciality,
            Modality = annotatedMedDataDto.Modality,
            BoxCoordinates = annotatedMedDataDto.BoxCoordinates,
            ExtractedKeyword = annotatedMedDataDto.ExtractedKeyword,
            Timestamps = annotatedMedDataDto.Timestamps,
            PressedButton = annotatedMedDataDto.PressedButton,
            Comment = annotatedMedDataDto.Comment,
            Email = user.Email,
            FullName = user.FullName,
            University = user.University,
            Position = user.Position,
            ClinicalExperience = user.ClinicalExperience,
            OrcidId = user.OrcidId,
        };

        var succeeded = await annotatedMedDataRepository.CreateAsync(newAnnotatedMedData);

        await medDataRepository.UpdateLock(
            annotatedMedDataDto.Id,
            annotatedMedDataDto.KeywordStates ?? string.Empty,
            isAnnotationStarted: true,
            isStudent: false);

        return Json(new { success = succeeded });
    }

    [HttpPut]
    public async Task<IActionResult> NextImage(int medDataId)
    {
        var succeeded = await medDataRepository.UpdateIsAnnotated(medDataId, false);

        return Json(new { success = succeeded });
    }

    [HttpPost]
    [Authorize(Roles = "Medical_Student")]
    public async Task<IActionResult> SubmitStudentAnnotations([FromBody] StudentAnnotationList annotationList)
    {
        if (annotationList?.Annotations == null || !annotationList.Annotations.Any())
        {
            return Json(new { success = false, message = "No annotations provided." });
        }

        try
        {
            var user = await userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized(new { success = false, message = "User not found." });
            }

            var entities = annotationList.Annotations.Select(dto => new AnnotatedByStudentsMedData
            {
                MedDataId = dto.Id,
                Coordinates = dto.Coordinates,
                TextualAnnotation = dto.TextualAnnotation,
                ImageUrl = dto.ImageUrl,
                ImageDescription = dto.ImageDescription,
                Sex = dto.Sex,
                Age = dto.Age,
                BodyRegion = dto.BodyRegion,
                Diagnosis = dto.Diagnosis,
                TreatmentName = dto.TreatmentName,
                Speciality = dto.Speciality,
                Modality = dto.Modality,
                Email = user.Email,
                FullName = user.FullName,
                University = user.University,
                Position = user.Position,
                ClinicalExperience = user.ClinicalExperience,
                OrcidId = user.OrcidId
            }).ToList();

            var succeeded = await annotatedByStudentsMedDataRepository.CreateAllAsync(entities);
            if (!succeeded)
            {
                return Json(new { success = false, message = "Failed to save annotations." });
            }

            await medDataRepository.UpdateIsAnnotated(annotationList.Annotations.First().Id, true);
            return Json(new { success = true, redirectUrl = "/Home/Student" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error while submitting student annotations.");
            return Json(new { success = false, message = "An error occurred while saving annotations." });
        }
    }
}
