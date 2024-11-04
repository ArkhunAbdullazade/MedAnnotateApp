using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Services;
using OfficeOpenXml;

namespace MedAnnotateApp.Infrastructure.Services;
public class ExcelLoaderService : IExcelLoaderService
{
    public List<MedData> LoadMedDataFromExcel(string filePath)
    {
        var medDataList = new List<MedData>();

        System.Console.WriteLine(123123123);

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using (var package = new ExcelPackage(new FileInfo(filePath)))
        {
            System.Console.WriteLine("check");
            System.Console.WriteLine(package.Workbook.Worksheets[0] is null);
            var worksheet = package.Workbook.Worksheets[0];
            int rowCount = worksheet.Dimension.Rows;

            for (int row = 3; row <= rowCount; row++)
            {
                var medData = new MedData
                {
                    Id = int.Parse(worksheet.Cells[row, 1].Value.ToString()!),
                    Pmcid = worksheet.Cells[row, 2].Value?.ToString(),
                    ImageUrl = worksheet.Cells[row, 5].Value?.ToString(),
                    ImageDescription = worksheet.Cells[row, 11].Value?.ToString(),
                    Sex = worksheet.Cells[row, 19].Value?.ToString(),
                    Age = worksheet.Cells[row, 20].Value?.ToString(),
                    SkinTone = worksheet.Cells[row, 21].Value?.ToString(),
                    BodyRegion = worksheet.Cells[row, 22].Value?.ToString(),
                    Diagnosis = worksheet.Cells[row, 23].Value?.ToString(),
                    TreatmentName = worksheet.Cells[row, 27].Value?.ToString(),
                    Speciality = worksheet.Cells[row, 31].Value?.ToString(),
                    Modality = worksheet.Cells[row, 32].Value?.ToString(),
                    IsAnnotated = false,
                };

                medDataList.Add(medData);
            }
        }

        return medDataList;
    }

    public List<(int, string)> LoadMedKeywordsFromExcel(string filePath)
    {
        var keywordList = new List<(int, string)>();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using (var package = new ExcelPackage(new FileInfo(filePath)))
        {
            var worksheet = package.Workbook.Worksheets[0];
            int rowCount = worksheet.Dimension.Rows;

            for (int row = 3; row <= rowCount; row++)
            {
                var keywords = worksheet.Cells[row, 12].Value?.ToString()?.Split(',')!;
                var medDataId = int.Parse(worksheet.Cells[row, 1].Value.ToString()!);

                foreach (var keyword in keywords)
                {
                    var trimmedKeyword = keyword.Trim();
                    if (!string.IsNullOrWhiteSpace(trimmedKeyword)) keywordList.Add((medDataId, trimmedKeyword));
                }
            }
        }

        return keywordList;
    }
}