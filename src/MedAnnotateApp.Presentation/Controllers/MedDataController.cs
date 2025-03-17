using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MedAnnotateApp.Presentation.Models;
using Microsoft.AspNetCore.Authorization;
using MedAnnotateApp.Core.Repositories;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Presentation.Dtos;

namespace MedAnnotateApp.Presentation.Controllers;

[Authorize]
public class MedDataController : Controller
{
    private readonly IAnnotatedMedDataRepository annotatedMedDataRepository;
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;

    public MedDataController(IAnnotatedMedDataRepository annotatedMedDataRepository, IMedDataRepository medDataRepository, UserManager<User> userManager)
    {
        this.annotatedMedDataRepository = annotatedMedDataRepository;
        this.medDataRepository = medDataRepository;
        this.userManager = userManager;
    }

    [HttpPost]
    public async Task<IActionResult> NextImage([FromBody] AnnotatedMedDatasDto annotatedMedDatasDto)
    {
        if (annotatedMedDatasDto == null || annotatedMedDatasDto.Items == null)
        {
            return BadRequest("No annotations provided.");
        }

        var user = await userManager.GetUserAsync(User);

        // Map each DTO to an AnnotatedMedData entity.
        IEnumerable<AnnotatedMedData> annotatedMedDataEntities = annotatedMedDatasDto.Items.Select(dto => new AnnotatedMedData
        {
            // MetaData
            MedDataId = dto.Id,
            ImageUrl = dto.ImageUrl,
            ImageDescription = dto.ImageDescription,
            Sex = dto.Sex,
            Age = dto.Age,
            SkinTone = dto.SkinTone,
            BodyRegion = dto.BodyRegion,
            Diagnosis = dto.Diagnosis,
            TreatmentName = dto.TreatmentName,
            Speciality = dto.Speciality,
            Modality = dto.Modality,

            // AnnotationData
            BoxCoordinates = dto.BoxCoordinates,
            ExtractedKeyword = dto.ExtractedKeyword,
            Timestamps = dto.Timestamps,
            PressedButton = dto.PressedButton,
            Comment = dto.Comment,

            // UserData
            Email = user?.Email,
            FullName = user?.FullName,
            University = user?.University,
            Position = user?.Position,
            ClinicalExperience = user!.ClinicalExperience,
            OrcidId = user?.OrcidId,
        });

        var createSucceeded = await annotatedMedDataRepository.CreateAllAsync(annotatedMedDataEntities);

        if (createSucceeded)
        {
            var updateSucceeded = await medDataRepository.UpdateIsAnnotated(annotatedMedDatasDto.MedDataId);
            return Json(new { success = updateSucceeded });
        }

        return Json(new { success = createSucceeded });
    }
}
