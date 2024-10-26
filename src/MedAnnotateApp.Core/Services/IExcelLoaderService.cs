using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Core.Services;
public interface IExcelLoaderService
{
    List<MedData> LoadMedDataFromExcel(string filePath);
    List<(int, string)> LoadMedKeywordsFromExcel(string filePath);
}