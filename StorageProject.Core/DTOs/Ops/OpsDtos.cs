namespace StorageProject.Core.DTOs.Ops;

public class OpsBoardDto
{
    public OpsFacilityDto Facility { get; set; } = null!;
    public OpsUserInfoDto? Me { get; set; }
    public List<OpsStaffDto> Staff { get; set; } = [];
    public List<OpsUnitDto> Units { get; set; } = [];
    public List<OpsPaymentDto> Payments { get; set; } = [];
    public List<OpsAllocationDto>? Allocations { get; set; }
    public List<OpsVerificationDto> Verifications { get; set; } = [];
    public List<OpsHandoverDto> Handovers { get; set; } = [];
    public List<OpsReturnDto> Returns { get; set; } = [];
    public List<OpsTicketDto> Tickets { get; set; } = [];
    public List<OpsRenewalDto>? Renewals { get; set; }
    public List<OpsContractDto>? Contracts { get; set; }
    public List<OpsAssignmentDto>? Assignments { get; set; }
    public OpsRevenueDto? Revenue { get; set; }
}

public class OpsUserInfoDto
{
    public long UserId { get; set; }
    public string Username { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string Role { get; set; } = null!;
    public string? StaffId { get; set; }
}

public class OpsFacilityDto
{
    public long FacilityId { get; set; }
    public string Name { get; set; } = null!;
    public string Address { get; set; } = null!;
}

public class OpsStaffDto
{
    public string StaffId { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string Shift { get; set; } = "08:00–17:00";
}

public class OpsUnitDto
{
    public string Code { get; set; } = null!;
    public string? Tenant { get; set; }
    public decimal Area { get; set; }
    public int Floor { get; set; }
    public string Type { get; set; } = "normal";
    public string Status { get; set; } = "EMPTY";
    public string? End { get; set; }
}

public class OpsPaymentDto
{
    public string Id { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public decimal Amount { get; set; }
    public string Method { get; set; } = "Chuyển khoản ngân hàng";
    public string ReportedAt { get; set; } = null!;
    public string Memo { get; set; } = null!;
    public string Offer { get; set; } = null!;
    public string Start { get; set; } = null!;
    public string End { get; set; } = null!;
    public string Pickup { get; set; } = null!;
    public string Status { get; set; } = "PENDING";
}

public class OpsAllocationDto
{
    public string Id { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Type { get; set; } = "normal";
    public string Offer { get; set; } = null!;
    public decimal MinArea { get; set; }
    public decimal MaxArea { get; set; }
    public string Start { get; set; } = null!;
    public string End { get; set; } = null!;
    public string Pickup { get; set; } = null!;
    public string Status { get; set; } = "PENDING";
    public string? Unit { get; set; }
}

public class OpsVerificationDto
{
    public string Id { get; set; } = null!;
    public string ReservationId { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public string Appointment { get; set; } = null!;
    public string Status { get; set; } = "TODO";
    public string? DocType { get; set; }
    public string? DocLast4 { get; set; }
    public string? VerifiedAt { get; set; }
}

public class OpsHandoverDto
{
    public string Id { get; set; } = null!;
    public string VerificationId { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Status { get; set; } = "WAITING";
    public string? Method { get; set; }
}

public class OpsReturnDto
{
    public string Id { get; set; } = null!;
    public string Contract { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Appointment { get; set; } = null!;
    public decimal Deposit { get; set; }
    public decimal Unpaid { get; set; }
    public string Status { get; set; } = "SCHEDULED";
    public OpsReturnReportDto? Report { get; set; }
}

public class OpsReturnReportDto
{
    public string Items { get; set; } = null!;
    public string Walls { get; set; } = null!;
    public string Keys { get; set; } = null!;
    public string Proposal { get; set; } = null!;
}

public class OpsTicketDto
{
    public string Id { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string CreatedAt { get; set; } = null!;
    public string Schedule { get; set; } = null!;
    public string Status { get; set; } = "OPEN";
    public string? Assignee { get; set; }
    public List<OpsTicketNoteDto> Notes { get; set; } = [];
}

public class OpsTicketNoteDto
{
    public string Author { get; set; } = null!;
    public string Content { get; set; } = null!;
    public string CreatedAt { get; set; } = null!;
}

public class OpsRenewalDto
{
    public string Id { get; set; } = null!;
    public string Contract { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public string From { get; set; } = null!;
    public string To { get; set; } = null!;
    public int Months { get; set; }
    public string Requested { get; set; } = null!;
    public string Status { get; set; } = "PENDING";
    public string? RejectionReason { get; set; }
}

public class OpsContractDto
{
    public string Id { get; set; } = null!;
    public string Customer { get; set; } = null!;
    public string Unit { get; set; } = null!;
    public string End { get; set; } = null!;
    public string Due { get; set; } = null!;
    public decimal Amount { get; set; }
    public string State { get; set; } = "ACTIVE";
    public List<OpsReminderDto> Reminders { get; set; } = [];
}

public class OpsReminderDto
{
    public string Note { get; set; } = null!;
    public string RemindedAt { get; set; } = null!;
}

public class OpsAssignmentDto
{
    public string Id { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string When { get; set; } = null!;
    public string? Staff { get; set; }
    public string Status { get; set; } = "OPEN";
    public string Ref { get; set; } = null!;
}

public class OpsRevenueDto
{
    public List<OpsRevenueMonthDto> Months { get; set; } = [];
    public List<OpsRevenueByTypeDto> ByType { get; set; } = [];
    public string AsOf { get; set; } = null!;
}

public class OpsRevenueMonthDto
{
    public string Label { get; set; } = null!;
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal Value { get; set; }
}

public class OpsRevenueByTypeDto
{
    public string Label { get; set; } = null!;
    public decimal Value { get; set; }
}

public class MismatchPaymentRequest
{
    public string? Note { get; set; }
}

public class VerifyCustomerRequest
{
    public string? DocType { get; set; }
    public string? DocNumber { get; set; }
    public bool PhotoMatched { get; set; }
    public bool InfoMatched { get; set; }
}

public class CompleteHandoverRequest
{
    public string UnlockMethod { get; set; } = null!;
}

public class ReturnInspectionRequest
{
    public string Items { get; set; } = null!;
    public string Walls { get; set; } = null!;
    public string Keys { get; set; } = null!;
    public string Proposal { get; set; } = null!;
}

public class TicketResponseRequest
{
    public string Note { get; set; } = null!;
    public string NextStatus { get; set; } = null!;
}

public class AllocateUnitRequest
{
    public string UnitCode { get; set; } = null!;
}

public class AssignStaffRequest
{
    public string StaffId { get; set; } = null!;
}

public class RejectRenewalRequest
{
    public string Reason { get; set; } = null!;
}

public class AddReminderRequest
{
    public string? Note { get; set; }
}

public class UpdateUnitStatusRequest
{
    public string Status { get; set; } = null!;
    public string? Reason { get; set; }
}

public class ReissueCredentialRequest
{
    public string UnitCode { get; set; } = null!;
    public string CredentialType { get; set; } = "CARD";
    public string? Reason { get; set; }
}

public class CreateStorageUnitRequest
{
    public string UnitNumber { get; set; } = null!;
    public long UnitTypeId { get; set; }
    public string? Floor { get; set; }
    public string? Zone { get; set; }
    public string? LocationDescription { get; set; }
}

public class UpdateStorageUnitRequest
{
    public string? UnitNumber { get; set; }
    public long? UnitTypeId { get; set; }
    public string? Floor { get; set; }
    public string? Zone { get; set; }
    public string? LocationDescription { get; set; }
    public string? Status { get; set; }
}

public class LockUnitRequest
{
    public string Reason { get; set; } = null!;
}
