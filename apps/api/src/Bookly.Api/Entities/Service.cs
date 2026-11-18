namespace Bookly.Api.Entities;

public class Service : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public int DurationMinutes { get; set; }

    /// <summary>Minutes the staff member stays busy after the service; not shown to customers.</summary>
    public int BufferMinutes { get; set; }

    /// <summary>Indicative price in euro cents; null when the price is on request.</summary>
    public int? PriceCents { get; set; }

    /// <summary>True when the price is a starting price ("da 100 €").</summary>
    public bool PriceIsFrom { get; set; }

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public ICollection<StaffService> Staff { get; } = [];
}
