namespace MedAnnotateApp.Core.Models;

/// <summary>The three category columns on MedData contain one value each; users may select several values.</summary>
public sealed record ImageSelectionFilters(string[] Specialities, string[] BodyRegions, string[] Modalities)
{
    public bool IsComplete => Specialities.Length > 0 && BodyRegions.Length > 0 && Modalities.Length > 0;

    public static ImageSelectionFilters Parse(string? speciality, string? bodyRegion, string? imageModality) =>
        new(Split(speciality), Split(bodyRegion), Split(imageModality));

    public bool Matches(MedData image) => IsComplete
        && Specialities.Contains(Normalize(image.Speciality))
        && BodyRegions.Contains(Normalize(image.BodyRegion))
        && Modalities.Contains(Normalize(image.Modality));

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? string.Empty;

    private static string[] Split(string? value) => (value ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(Normalize).Where(value => value.Length > 0).Distinct().ToArray();
}
