using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MedAnnotateApp.Presentation.ActionFilters;
public class AuthorizationAccessFilter : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.ActionDescriptor.RouteValues["action"] != "AuthorizationAccess" && !context.HttpContext.Session.TryGetValue("Authorized", out _))
        {
            context.Result = new RedirectToActionResult("AuthorizationAccess", "Identity", null);
        }
    }
}