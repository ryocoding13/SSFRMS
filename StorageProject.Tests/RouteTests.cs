using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using StorageProject.Api.Endpoints;
using StorageProject.Core.Interfaces;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class RouteTests
{
    [Fact] public void CheckoutAndOpsRoutesAreUnique()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddScoped<IReservationService, ReservationService>();
        builder.Services.AddScoped<IPayOSService, PayOSService>();
        builder.Services.AddScoped<IStaffService, StaffService>();
        builder.Services.AddScoped<IManagerService, ManagerService>();
        builder.Services.AddScoped<IFacilityOpsService, FacilityOpsService>();
        var app = builder.Build();
        app.MapReservationEndpoints(); app.MapStaffEndpoints(); app.MapManagerEndpoints(); app.MapFacilityOpsEndpoints();
        var routes = ((IEndpointRouteBuilder)app).DataSources.SelectMany(s => s.Endpoints).OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["ANY"])
                .Select(method => $"{method} {e.RoutePattern.RawText}")).ToList();
        Assert.DoesNotContain(routes.GroupBy(r => r), g => g.Count() > 1);
        Assert.Contains("POST /api/reservations/{id:long}/pay-at-facility", routes);
        Assert.Contains("PUT /api/staff/units/{id}/status", routes);
        Assert.Single(routes, r => r == "GET /api/ops/board");
    }
}
