using System.ComponentModel.DataAnnotations;
using MedAnnotateApp.Presentation.Dtos;
using Xunit;

namespace MedAnnotateApp.Tests;

public class AuthAccessTests
{
    [Theory]
    [InlineData("specialist@gmail.com")]
    [InlineData("researcher@outlook.com")]
    [InlineData("doctor@clinic.example")]
    public void SignupAcceptsOrdinaryEmailAddresses(string email)
    {
        var signup = ValidSignup();
        signup.Email = email;
        Assert.Empty(Validate(signup));
    }

    [Fact]
    public void SignupStillRequiresAValidEmailAndPersonalPassword()
    {
        var signup = ValidSignup();
        signup.Email = "invalid-email";
        signup.Password = "";
        Assert.Contains(Validate(signup), error => error.MemberNames.Contains(nameof(SignupDto.Email)));
        Assert.Contains(Validate(signup), error => error.MemberNames.Contains(nameof(SignupDto.Password)));
    }

    [Theory]
    [InlineData("Speciality")]
    [InlineData("BodyRegion")]
    [InlineData("ImageModality")]
    public void EachFilterRejectsNullEmptyBlankOrUnlistedSelections(string property)
    {
        foreach (var selection in new string[]?[] { null, [], [""], ["   "], ["invented option"], ["ct", ""] })
        {
            var filters = ValidFilters();
            typeof(ImageFiltersDto).GetProperty(property)!.SetValue(filters, selection);
            Assert.Contains(Validate(filters), error => error.MemberNames.Contains(property));
        }
    }

    [Fact]
    public void SignupCannotBypassFilterRequirements()
    {
        var signup = ValidSignup();
        signup.BodyRegion = [];
        Assert.Contains(Validate(signup), error => error.MemberNames.Contains(nameof(SignupDto.BodyRegion)));
    }

    [Fact]
    public void AllListsAcceptMultipleSelections()
    {
        var filters = new ImageFiltersDto
        {
            Speciality = ["cardiology", "dermatology"],
            BodyRegion = ["abdomen", "thorax"],
            ImageModality = ["ct", "photo"]
        };
        Assert.Empty(Validate(filters));
    }

    [Fact]
    public void StoredSelectionsAreTrimmedNormalizedAndDeduplicated()
    {
        Assert.Equal("cardiology,dermatology", ImageFiltersDto.JoinSelection([" Cardiology ", "cardiology", "DERMATOLOGY"]));
    }

    private static ImageFiltersDto ValidFilters() => new()
    {
        Speciality = ["cardiology"], BodyRegion = ["thorax"], ImageModality = ["ct"]
    };

    private static SignupDto ValidSignup() => new()
    {
        Email = "specialist@gmail.com", FullName = "Research Specialist",
        Password = "Participant1!", ConfirmPassword = "Participant1!",
        Position = "specialist", University = "Community clinic", ClinicalExperience = 3,
        Speciality = ["cardiology"], BodyRegion = ["thorax"], ImageModality = ["ct"]
    };

    private static List<ValidationResult> Validate(object model)
    {
        var errors = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), errors, validateAllProperties: true);
        return errors;
    }
}
