namespace Bookly.Api.Entities;

/// <summary>Area of the app a navigation item belongs to (DEC-019).</summary>
public enum NavigationArea
{
    Admin,
    Platform,
}

/// <summary>Sidebar entry served by the API (schema "ui", DEC-019).</summary>
public class NavigationItem
{
    public int Id { get; set; }

    /// <summary>Stable identifier, e.g. "admin.calendar".</summary>
    public required string Key { get; set; }

    /// <summary>i18n key translated by the client, e.g. "nav.calendar".</summary>
    public required string LabelKey { get; set; }

    /// <summary>Icon name from the client allowlist (lucide-react), e.g. "calendar-days".</summary>
    public required string Icon { get; set; }

    /// <summary>Client route, e.g. "/admin/servizi".</summary>
    public required string Route { get; set; }

    public NavigationArea Area { get; set; }

    public int SortOrder { get; set; }

    public int? ParentId { get; set; }

    public bool IsEnabled { get; set; } = true;

    public NavigationItem? Parent { get; set; }

    public ICollection<NavigationItemRole> Roles { get; } = [];
}

public class NavigationItemRole
{
    public int NavigationItemId { get; set; }

    /// <summary>"Owner", "Staff" (tenant roles) or "SuperAdmin" (platform role).</summary>
    public required string Role { get; set; }
}
