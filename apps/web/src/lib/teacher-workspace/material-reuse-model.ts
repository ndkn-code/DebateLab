export interface ReusablePlacement {
  id: string;
  versionId: string;
  status: string;
  audienceMode: string;
  releaseAt: string | null;
  expiresAt: string | null;
  ruleCount: number;
}

export function materialReuseErrorMessage(error: unknown, locale: string) {
  const code = error instanceof Error ? error.message : "";
  const vi = locale === "vi";
  if (/FORBIDDEN|Unauthorized|UNAUTHORIZED|permission denied/i.test(code))
    return vi
      ? "Bạn không còn quyền quản lý lớp hoặc tài liệu này. Hãy kiểm tra quyền truy cập."
      : "You no longer have access to manage this class or material. Check your access.";
  if (/MATERIALS_DISABLED/.test(code))
    return vi
      ? "Thư viện tài liệu dùng chung chưa được bật."
      : "The shared material library is not enabled yet.";
  if (/MATERIAL_NOT_ELIGIBLE|LMS_MATERIAL_NOT_READY/.test(code))
    return vi
      ? "Tài liệu chưa sẵn sàng hoặc chưa được duyệt. Hãy tải lại thư viện và chọn tài liệu khác."
      : "This material is not ready or approved. Reload the library and choose another material.";
  if (/MATERIAL_EXISTING_RESTRICTIONS/.test(code))
    return vi
      ? "Tài liệu đã được đặt với phiên bản, đối tượng hoặc lịch phát hành khác. Các cài đặt đó được giữ nguyên."
      : "This material already has a different version, audience, or release setting. Those settings were preserved.";
  if (/MATERIAL_READBACK_UNAVAILABLE/.test(code))
    return vi
      ? "Yêu cầu xuất bản đã được xử lý nhưng chưa đọc lại được kết quả. Hãy thử lại để xác nhận."
      : "The publish request was processed, but its result could not be read back. Retry to confirm.";
  return vi
    ? "Chưa xác nhận được việc xuất bản. Bản nháp có thể đã được lưu; hãy thử lại để tiếp tục."
    : "Publishing could not be confirmed. A draft may have been saved; retry to continue.";
}

/** Never turn a previously restricted placement into an unrestricted release. */
export function reusablePlacementState(
  placement: ReusablePlacement | null,
  versionId: string,
) {
  if (!placement) return "create";
  if (
    placement.versionId !== versionId ||
    placement.audienceMode !== "all" ||
    placement.releaseAt ||
    placement.expiresAt ||
    placement.ruleCount
  )
    return "restricted";
  if (placement.status === "published") return "published";
  return placement.status === "draft" ? "resume" : "restricted";
}

export interface MaterialReuseOperations {
  read: () => Promise<ReusablePlacement | null>;
  place: () => Promise<void>;
  publish: (placementId: string) => Promise<void>;
}

/** A partial publish failure leaves a resumable draft; confirmation requires readback. */
export async function publishReusablePlacement(
  versionId: string,
  operations: MaterialReuseOperations,
) {
  let placement = await operations.read();
  if (!placement) {
    try {
      await operations.place();
    } catch (error) {
      // Unique target constraint also protects races between two browser tabs.
      placement = await operations.read();
      if (!placement) throw error;
    }
    placement ??= await operations.read();
  }
  const state = reusablePlacementState(placement, versionId);
  if (!placement || state === "restricted" || state === "create")
    throw new Error("MATERIAL_EXISTING_RESTRICTIONS");
  if (state === "published")
    return {
      placementId: placement.id,
      status: "published" as const,
      alreadyPublished: true,
    };
  await operations.publish(placement.id);
  const saved = await operations.read();
  if (reusablePlacementState(saved, versionId) !== "published")
    throw new Error("MATERIAL_READBACK_UNAVAILABLE");
  return {
    placementId: placement.id,
    status: "published" as const,
    alreadyPublished: false,
  };
}
