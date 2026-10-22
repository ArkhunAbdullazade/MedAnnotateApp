using MedAnnotateApp.Core.Services;

namespace MedAnnotateApp.Tests;

public class CoordinateTests
{
    private const string Valid = """
        {"version":1,"coordinateSystem":"image-pixels","imageWidth":1200,"imageHeight":800,"annotations":[{"type":"rectangle","points":[[300,200],[900,200],[900,600],[300,600]]}]}
        """;

    [Fact]
    public void KnownOriginalPixelRectanglePassesWithoutChangingPayload()
    {
        Assert.True(AnnotationCoordinates.TryValidate(Valid, out var error));
        Assert.Empty(error);
    }

    [Theory]
    [InlineData("")]
    [InlineData("null")]
    [InlineData("[[[0,0],[10,0],[10,10]]]")]
    [InlineData("{\"version\":2}")]
    [InlineData("{\"version\":1,\"coordinateSystem\":42}")]
    public void UnsupportedMalformedAndLegacyPayloadsAreRejected(string json) => Assert.False(AnnotationCoordinates.TryValidate(json, out _));

    [Theory]
    [InlineData("\"imageWidth\":1200", "\"imageWidth\":0")]
    [InlineData("\"imageWidth\":1200", "\"imageWidth\":1200.5")]
    [InlineData("\"imageWidth\":1200", "\"imageWidth\":100001")]
    [InlineData("[300,200]", "[-1,200]")]
    [InlineData("[300,200]", "[1201,200]")]
    [InlineData("[300,200]", "[300,801]")]
    [InlineData("[300,200]", "[1e309,200]")]
    [InlineData("[300,200]", "[\"300\",200]")]
    [InlineData("[300,200]", "[300]")]
    [InlineData("[300,200],[900,200],[900,600],[300,600]", "[300,200],[900,200],[900,200],[300,200]")]
    [InlineData("[300,200],[900,200],[900,600],[300,600]", "[300,200],[900,200],[800,600],[300,600]")]
    [InlineData("[300,200],[900,200],[900,600],[300,600]", "[300,200],[900,250],[900,600],[300,550]")]
    public void InvalidDimensionsBoundsNumbersAndShapesAreRejected(string oldValue, string newValue) =>
        Assert.False(AnnotationCoordinates.TryValidate(Valid.Replace(oldValue, newValue), out _));

    [Fact]
    public void ClosedFreehandAndImageEdgeCoordinatesPass()
    {
        var json = Valid.Replace("rectangle", "freehand").Replace("[300,200],[900,200],[900,600],[300,600]", "[0,0],[1200,0],[1200,800],[0,800],[0,0]");
        Assert.True(AnnotationCoordinates.TryValidate(json, out _));
    }

    [Fact]
    public void EmptyAnnotationsAndTooManyVerticesAreRejected()
    {
        Assert.False(AnnotationCoordinates.TryValidate(Valid.Replace("[{\"type\":\"rectangle\",\"points\":[[300,200],[900,200],[900,600],[300,600]]}]", "[]"), out _));
        var points = string.Join(',', Enumerable.Repeat("[300,200]", 20001));
        var json = $$"""{"version":1,"coordinateSystem":"image-pixels","imageWidth":1200,"imageHeight":800,"annotations":[{"type":"freehand","points":[{{points}}]}]}""";
        Assert.False(AnnotationCoordinates.TryValidate(json, out _));
    }
}
