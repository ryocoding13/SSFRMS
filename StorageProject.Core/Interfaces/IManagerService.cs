using StorageProject.Core.DTOs.Ops;

namespace StorageProject.Core.Interfaces;

/// <summary>
/// Dịch vụ nghiệp vụ dành cho vai trò Quản lý cơ sở (Facility Manager — UC13–UC18).
/// </summary>
public interface IManagerService
{
    /// <summary>Lấy dữ liệu bảng công việc điều hành của Quản lý cơ sở.</summary>
    Task<OpsBoardDto> GetManagerBoardAsync(long userId, CancellationToken ct = default);

    /// <summary>Phân bổ ô kho cụ thể cho đơn đặt chỗ của khách (M05 / UC14).</summary>
    Task AllocateUnitAsync(long userId, string id, AllocateUnitRequest request, CancellationToken ct = default);

    /// <summary>Phân công nhân viên thực hiện các công việc tại cơ sở (UC15).</summary>
    Task AssignStaffAsync(long userId, string id, AssignStaffRequest request, CancellationToken ct = default);

    /// <summary>Duyệt yêu cầu gia hạn hợp đồng thuê kho (M01 / UC16 / D32).</summary>
    Task ApproveRenewalAsync(long userId, string id, CancellationToken ct = default);

    /// <summary>Từ chối yêu cầu gia hạn kèm lý do (UC16).</summary>
    Task RejectRenewalAsync(long userId, string id, RejectRenewalRequest request, CancellationToken ct = default);

    /// <summary>Thêm ghi chú nhắc nhở hợp đồng quá hạn vào hồ sơ quá hạn (M04 / D32).</summary>
    Task AddContractReminderAsync(long userId, string id, AddReminderRequest request, CancellationToken ct = default);

    // Facility storage unit management (UC13)
    /// <summary>Lấy danh sách các ô kho thuộc cơ sở mình quản lý.</summary>
    Task<IReadOnlyList<OpsUnitDto>> GetFacilityUnitsAsync(long userId, CancellationToken ct = default);

    /// <summary>Tạo mới ô kho vật lý trong cơ sở.</summary>
    Task<OpsUnitDto> CreateUnitAsync(long userId, CreateStorageUnitRequest request, CancellationToken ct = default);

    /// <summary>Cập nhật thông tin ô kho vật lý.</summary>
    Task<OpsUnitDto> UpdateUnitAsync(long userId, string id, UpdateStorageUnitRequest request, CancellationToken ct = default);

    /// <summary>Khóa hoặc mở khóa ô kho (đưa vào bảo trì / ngừng hoạt động).</summary>
    Task LockUnitAsync(long userId, string id, LockUnitRequest request, CancellationToken ct = default);
}
