// DELISHAFRICA_SPRINT25_OPERATION_CONTEXT_MEMORY_V1
export type MerchantOperationFocus = {
  scrollY: number;
  showTools: boolean;
  priorityKey: string;
};

let merchantOperationFocus: MerchantOperationFocus = {
  scrollY: 0,
  showTools: false,
  priorityKey: "",
};

export function readMerchantOperationFocus(): MerchantOperationFocus {
  return { ...merchantOperationFocus };
}

export function writeMerchantOperationFocus(
  patch: Partial<MerchantOperationFocus>,
): MerchantOperationFocus {
  merchantOperationFocus = {
    scrollY: Math.max(0, Number(patch.scrollY ?? merchantOperationFocus.scrollY) || 0),
    showTools: Boolean(patch.showTools ?? merchantOperationFocus.showTools),
    priorityKey: String(patch.priorityKey ?? merchantOperationFocus.priorityKey),
  };
  return readMerchantOperationFocus();
}

export function clearMerchantOperationFocus(): void {
  merchantOperationFocus = { scrollY: 0, showTools: false, priorityKey: "" };
}
