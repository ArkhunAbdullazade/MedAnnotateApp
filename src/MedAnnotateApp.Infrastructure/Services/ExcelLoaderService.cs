using MedAnnotateApp.Core.Models;
using MedAnnotateApp.Core.Services;
using OfficeOpenXml;

namespace MedAnnotateApp.Infrastructure.Services;
public class ExcelLoaderService : IExcelLoaderService
{
    public List<MedData> LoadMedDataFromExcel(string filePath)
    {
        var medDataList = new List<MedData>();

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using (var package = new ExcelPackage(new FileInfo(filePath)))
        {
            System.Console.WriteLine(1);
            var worksheet = package.Workbook.Worksheets[0];
            int rowCount = worksheet.Dimension.Rows;
            System.Console.WriteLine(2);

            for (int row = 3; row <= rowCount; row++)
            {
                var medData = new MedData
                {
                    Id = int.Parse(worksheet.Cells[row, 1].Value.ToString()!),
                    ImageUrl = worksheet.Cells[row, 2].Value?.ToString(),
                    ImageDescription = worksheet.Cells[row, 3].Value?.ToString(),
                    Sex = worksheet.Cells[row, 6].Value?.ToString(),
                    Age = worksheet.Cells[row, 7].Value?.ToString(),
                    SkinTone = worksheet.Cells[row, 8].Value?.ToString(),
                    BodyRegion = worksheet.Cells[row, 9].Value?.ToString(),
                    Diagnosis = worksheet.Cells[row, 10].Value?.ToString(),
                    TreatmentName = worksheet.Cells[row, 11].Value?.ToString(),
                    Speciality = worksheet.Cells[row, 12].Value?.ToString(),
                    Modality = worksheet.Cells[row, 13].Value?.ToString(),
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
                var keywords = worksheet.Cells[row, 4].Value?.ToString()?.Split(',')!;
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