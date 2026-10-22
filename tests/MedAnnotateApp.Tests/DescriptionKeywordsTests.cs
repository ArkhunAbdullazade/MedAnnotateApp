using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using MedAnnotateApp.Presentation.Models;

namespace MedAnnotateApp.Tests;

public sealed class DescriptionKeywordsTests
{
    [Fact]
    public void TermsStayInTheirOriginalTextAndFollowDescriptionOrder()
    {
        var html = Render("A lesion beside a boundary.", ["boundary", "lesion"]);
        Assert.Equal(["lesion", "boundary"], Keywords(html));
        Assert.Equal("A lesion beside a boundary.", PlainText(html));
    }

    [Fact]
    public void RepeatedAndDifferentlyCasedOccurrencesKeepTheirCanonicalTerm()
    {
        var html = Render("Lesion and LESION", ["lesion"]);
        Assert.Equal(["lesion", "lesion"], Keywords(html));
        Assert.Equal("Lesion and LESION", PlainText(html));
        Assert.Equal(2, Regex.Matches(html, "id=\"keyword-[^\"]+\"").Select(match => match.Value).Distinct().Count());
    }

    [Fact]
    public void OverlapUsesLongestPhraseAndCanFindShorterTermLater()
    {
        var html = Render("large mass and mass", ["mass", "large mass"]);
        Assert.Equal(["large mass", "mass"], Keywords(html));
        Assert.Equal("large mass and mass", PlainText(html));
    }

    [Fact]
    public void DescriptionAndCanonicalTermAreEncodedInsteadOfBecomingMarkup()
    {
        var html = Render("<script>alert(1)</script> and a \"mass\"", ["\"mass\""]);
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
        Assert.Equal(["\"mass\""], Keywords(html));
        Assert.Equal("<script>alert(1)</script> and a \"mass\"", PlainText(html));
    }

    [Fact]
    public void UnknownMissingAndDuplicateTermsDoNotInventTextOrResponses()
    {
        Assert.Empty(Keywords(Render(null, ["mass"])));
        Assert.Empty(Keywords(Render("Source description", ["missing"])));
        Assert.Equal(["mass"], Keywords(Render("mass", [null, "", "mass", "mass"])));
    }

    private static string Render(string? text, IReadOnlyList<string?> terms)
    {
        using var writer = new StringWriter();
        DescriptionKeywords.Highlight(text, terms).WriteTo(writer, HtmlEncoder.Default);
        return writer.ToString();
    }

    private static string[] Keywords(string html) => Regex.Matches(html, "data-keyword=\"([^\"]*)\"")
        .Select(match => System.Net.WebUtility.HtmlDecode(match.Groups[1].Value)).ToArray();

    private static string PlainText(string html) => System.Net.WebUtility.HtmlDecode(Regex.Replace(html, "<[^>]+>", ""));
}
