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
    public async Task<IActionResult> ProcessAnnotatedMedData([FromBody] AnnotatedMedDataDto annotatedMedDataDto)
    {
        var user = await userManager.GetUserAsync(User);

        var newAnnotatedMedData = new AnnotatedMedData {
            // MetaData
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

            // AnnotationData
            BoxCoordinates = annotatedMedDataDto.BoxCoordinates,
            ExtractedKeyword = annotatedMedDataDto.ExtractedKeyword,
            Timestamps = annotatedMedDataDto.Timestamps,
            PressedButton = annotatedMedDataDto.PressedButton,

            // UserData
            Email = user?.Email,
            FullName = user?.FullName,
            University = user?.University,
            Position = user?.Position,
            ClinicalExperience = user!.ClinicalExperience,
        };

        var succeeded = await annotatedMedDataRepository.CreateAsync(newAnnotatedMedData);

        return Json(new { success = succeeded });
    }

    [HttpPut]
    public async Task<IActionResult> NextImage(int MedDataId)
    {
        var succeeded = await medDataRepository.UpdateIsAnnotated(MedDataId);
        
        return Json(new { success = succeeded });
    }
}
