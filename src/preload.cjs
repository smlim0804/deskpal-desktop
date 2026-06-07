const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskPal", {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  getSystemStats: () => ipcRenderer.invoke("system:stats"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  updateSlot: (index, patch) => ipcRenderer.invoke("settings:slot:update", { index, patch }),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  getMachineId: () => ipcRenderer.invoke("machine:id"),
  copyText: (value) => ipcRenderer.invoke("clipboard:write", value),
  activateLicense: (licenseKey) => ipcRenderer.invoke("license:activate", licenseKey),
  openLicenseCheckout: (plan) => ipcRenderer.invoke("license:checkout", plan),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  openUpdate: () => ipcRenderer.invoke("updates:open"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  pickArea: (slotIndex) => ipcRenderer.invoke("area:pick", slotIndex),
  completeAreaPick: (result) => ipcRenderer.invoke("area:pick-complete", result),
  openShortcut: (shortcut) => ipcRenderer.invoke("shortcut:open", shortcut),
  pickAppShortcut: () => ipcRenderer.invoke("app:pick"),
  pickShortcutImage: () => ipcRenderer.invoke("image:pick"),
  pickSpriteImage: () => ipcRenderer.invoke("sprite-image:pick"),
  setClickThrough: (ignore, options = {}) =>
    ipcRenderer.send("overlay:click-through", {
      ignore: !!ignore,
      preserveFocus: options?.preserveFocus === true,
    }),
  setOverlayIdle: (idle) => ipcRenderer.send("overlay:idle", idle === true),
  openSettings: () => ipcRenderer.send("settings:show"),
  closeSettings: () => ipcRenderer.send("settings:hide"),
  quit: () => ipcRenderer.send("app:quit"),
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
  onCursorPoint: (callback) => {
    const listener = (_event, point) => callback(point);
    ipcRenderer.on("cursor:point", listener);
    return () => ipcRenderer.removeListener("cursor:point", listener);
  },
  onAreaPickStart: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("area:pick-start", listener);
    return () => ipcRenderer.removeListener("area:pick-start", listener);
  },
});
