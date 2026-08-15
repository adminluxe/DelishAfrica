// DELISHAFRICA_SPRINT25_OPERATION_CONTEXT_MEMORY_V1
export type CourierOperationFocus = {
  scrollY: number;
  showTools: boolean;
  priorityKey: string;
};

let courierOperationFocus: CourierOperationFocus = {
  scrollY: 0,
  showTools: false,
  priorityKey: "",
};

export function readCourierOperationFocus(): CourierOperationFocus {
  return { ...courierOperationFocus };
}

export function writeCourierOperationFocus(
  patch: Partial<CourierOperationFocus>,
): CourierOperationFocus {
  courierOperationFocus = {
    scrollY: Math.max(0, Number(patch.scrollY ?? courierOperationFocus.scrollY) || 0),
    showTools: Boolean(patch.showTools ?? courierOperationFocus.showTools),
    priorityKey: String(patch.priorityKey ?? courierOperationFocus.priorityKey),
  };
  return readCourierOperationFocus();
}

export function clearCourierOperationFocus(): void {
  courierOperationFocus = { scrollY: 0, showTools: false, priorityKey: "" };
}
