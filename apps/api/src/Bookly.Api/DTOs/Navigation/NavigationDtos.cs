using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Navigation;

/// <summary>Sidebar entry for the current user (DEC-019).</summary>
public sealed record NavigationItemDto(string Key, string LabelKey, string Icon, string Route, string? ParentKey);

/// <summary>Full entry, for the platform admin page that manages the menu.</summary>
public sealed record NavigationAdminItemDto(
    int Id,
    string Key,
    string LabelKey,
    string Icon,
    string Route,
    string Area,
    int SortOrder,
    bool IsEnabled,
    IReadOnlyList<string> Roles);

public sealed record UpdateNavigationItemRequest(
    bool? IsEnabled,
    [Range(0, 10_000)] int? SortOrder);
