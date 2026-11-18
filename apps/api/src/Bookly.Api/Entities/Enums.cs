namespace Bookly.Api.Entities;

public enum TenantStatus
{
    Active,
    Suspended,
}

/// <summary>Role of a user inside a single tenant.</summary>
public enum TenantRole
{
    Owner,
    Staff,
}

public enum AppointmentStatus
{
    Confirmed,
    CancelledByCustomer,
    CancelledByBusiness,
    Completed,
    NoShow,
}

/// <summary>Theme of the public tenant page (DEC-016).</summary>
public enum TenantGround
{
    Light,
    Dark,
}

/// <summary>Heading font family offered to tenants (DEC-016).</summary>
public enum TenantHeadingFont
{
    Script,
    Serif,
    Sans,
}
