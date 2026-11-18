namespace Bookly.Api.Infrastructure.Http;

/// <summary>Outcome of a business operation: a value, or an HTTP status with a stable error code.</summary>
public sealed record ServiceResult<T>(T? Value, int Status, string? Code, string? Title)
{
    public bool Succeeded => Code is null;

    public static ServiceResult<T> Ok(T value, int status = StatusCodes.Status200OK) => new(value, status, null, null);

    public static ServiceResult<T> Fail(int status, string code, string title) => new(default, status, code, title);

    public IResult ToProblem() => ApiProblems.Create(Status, Code!, Title!);
}
