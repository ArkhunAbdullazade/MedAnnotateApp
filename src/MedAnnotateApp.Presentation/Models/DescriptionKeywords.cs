using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc.Rendering;
using MedAnnotateApp.Core.Models;

namespace MedAnnotateApp.Presentation.Models;

public static class DescriptionKeywords
{
    // Match the original description only. Diagnosis is separate display text.
    public static IHtmlContent Highlight(string? description, IReadOnlyList<string?>? keywords)
    {
        var text = MedDataDescription.SplitLegacySource(description).Description ?? string.Empty;
        var terms = (keywords ?? []).Where(term => !string.IsNullOrWhiteSpace(term))
            .Distinct(StringComparer.Ordinal).ToArray();
        var content = new HtmlContentBuilder();
        var position = 0;
        var occurrence = 0;
        while (position < text.Length)
        {
            var match = terms.Select((term, index) => new
                {
                    Term = term!, Index = index,
                    Position = text.IndexOf(term!, position, StringComparison.OrdinalIgnoreCase)
                })
                .Where(item => item.Position >= 0)
                .OrderBy(item => item.Position).ThenByDescending(item => item.Term.Length)
                .FirstOrDefault();
            if (match == null)
            {
                content.Append(text[position..]);
                break;
            }

            content.Append(text[position..match.Position]);
            var span = new TagBuilder("span");
            span.AddCssClass("keyword not_annotated_keyword");
            span.Attributes["id"] = $"keyword-{match.Index}-{occurrence++}";
            span.Attributes["data-keyword"] = match.Term;
            span.Attributes["role"] = "button";
            span.Attributes["tabindex"] = "0";
            span.InnerHtml.Append(text.Substring(match.Position, match.Term.Length));
            content.AppendHtml(span);
            position = match.Position + match.Term.Length;
        }
        return content;
    }
}
