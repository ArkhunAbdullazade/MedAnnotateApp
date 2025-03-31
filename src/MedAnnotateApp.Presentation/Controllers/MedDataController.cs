using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MedAnnotateApp.Presentation.Models;
using Microsoft.AspNetCore.Authorization;
using MedAnnotateApp.Core.Repositories;
using Microsoft.AspNetCore.Identity;
using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Presentation.Dtos;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Linq;

namespace MedAnnotateApp.Presentation.Controllers;

[Authorize]
public class MedDataController : Controller
{
    private readonly IAnnotatedMedDataRepository annotatedMedDataRepository;
    private readonly IAnnotatedByStudentsMedDataRepository annotatedByStudentsMedDataRepository;
    private readonly IMedDataRepository medDataRepository;
    private readonly UserManager<User> userManager;

    public MedDataController(IAnnotatedMedDataRepository annotatedMedDataRepository, IAnnotatedByStudentsMedDataRepository annotatedByStudentsMedDataRepository, IMedDataRepository medDataRepository, UserManager<User> userManager)
    {
        this.annotatedMedDataRepository = annotatedMedDataRepository;
        this.annotatedByStudentsMedDataRepository = annotatedByStudentsMedDataRepository;
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
            Comment = annotatedMedDataDto.Comment,

            // UserData
            Email = user?.Email,
            FullName = user?.FullName,
            University = user?.University,
            Position = user?.Position,
            ClinicalExperience = user!.ClinicalExperience,
            OrcidId = user?.OrcidId,
        };

        var succeeded = await annotatedMedDataRepository.CreateAsync(newAnnotatedMedData);

        await medDataRepository.UpdateLock(annotatedMedDataDto.Id, annotatedMedDataDto.KeywordStates!, true, false);

        return Json(new { success = succeeded });
    }

    [HttpPut]
    public async Task<IActionResult> NextImage(int MedDataId)
    {
        var succeeded = await medDataRepository.UpdateIsAnnotated(MedDataId, false);
        
        return Json(new { success = succeeded });
    }
    
    /// <summary>
    /// Handles the submission of student annotations
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Medical_Student")]
    public async Task<IActionResult> SubmitStudentAnnotations([FromBody] StudentAnnotationList annotationList)
    {
        if (annotationList?.Annotations == null || !annotationList.Annotations.Any())
        {
            return Json(new { success = false, message = "No annotations provided" });
        }

        try
        {
            // Get the current user
            var user = await userManager.GetUserAsync(User);
            if (user == null)
            {
                return Json(new { success = false, message = "User not found" });
            }

            // Create entities for each annotation
            var entities = annotationList.Annotations.Select(dto => new AnnotatedByStudentsMedData
            {
                Id = 0, // Auto-increment
                MedDataId = dto.Id,
                
                // Store coordinates and textual annotations separately
                Coordinates = dto.Coordinates,
                TextualAnnotation = dto.TextualAnnotation,
                
                // Metadata from original image
                ImageUrl = dto.ImageUrl,
                ImageDescription = dto.ImageDescription,
                Sex = dto.Sex,
                Age = dto.Age,
                BodyRegion = dto.BodyRegion,
                Diagnosis = dto.Diagnosis,
                TreatmentName = dto.TreatmentName,
                Speciality = dto.Speciality,
                Modality = dto.Modality,
                
                // User info for analytics
                Email = user.Email,
                FullName = user.FullName,
                University = user.University,
                Position = user.Position,
                ClinicalExperience = user.ClinicalExperience,
                OrcidId = user.OrcidId
            }).ToList();
            
            // Save all annotations
            var succeeded = await annotatedByStudentsMedDataRepository.CreateAllAsync(entities);
            
            if (succeeded)
            {
                // Mark the MedData as processed
                await medDataRepository.UpdateIsAnnotated(annotationList.Annotations.First().Id, true);
                return Json(new { success = true, redirectUrl = "/Home/Student" });
            }
            else
            {
                return Json(new { success = false, message = "Failed to save annotations" });
            }
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = $"An error occurred: {ex.Message}" });
        }
    }
}
