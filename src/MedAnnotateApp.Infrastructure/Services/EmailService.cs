using System.Net;
using System.Net.Mail;
using MedAnnotateApp.Core.Services;
using MedAnnotateApp.Infrastructure.Settings;
using Microsoft.Extensions.Options;

namespace MedAnnotateApp.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly SmtpSettings smtpSettings;

    public EmailService(IOptions<SmtpSettings> smtpSettings)
    {
        this.smtpSettings = smtpSettings.Value;
    }

    public async Task SendEmailAsync(string email, string subject, string message)
    {
        using (var smtpClient = new SmtpClient(smtpSettings.Server, smtpSettings.Port))
        {
            smtpClient.UseDefaultCredentials = false;
            smtpClient.DeliveryMethod = SmtpDeliveryMethod.Network;
            smtpClient.Credentials = new NetworkCredential(smtpSettings.SenderEmail, smtpSettings.Password);
            smtpClient.EnableSsl = smtpSettings.EnableSsl;

        var mailMessage = new MailMessage(smtpSettings.SenderEmail!, email)
        {   
            // From = new MailAddress(smtpSettings.SenderEmail!, smtpSettings.SenderName),
            Subject = subject,
            Body = message,
            IsBodyHtml = true,
        };

        await smtpClient.SendMailAsync(mailMessage);
        }
    }
}