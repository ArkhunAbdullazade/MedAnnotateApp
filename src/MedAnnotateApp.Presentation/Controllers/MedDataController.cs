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
    private readonly UserManager<User> userManager;

    public MedDataController(IAnnotatedMedDataRepository annotatedMedDataRepository, UserManager<User> userManager)
    {
        this.annotatedMedDataRepository = annotatedMedDataRepository;
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

        System.Console.WriteLine("12312312312312312312312123123123");

        var succeeded = await annotatedMedDataRepository.CreateAsync(newAnnotatedMedData);

        return Json(new { success = succeeded });
    }
}
