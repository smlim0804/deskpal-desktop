const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("busyPet", {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  pickArea: (slotIndex) => ipcRenderer.invoke("area:pick", slotIndex),
  completeAreaPick: (result) => ipcRenderer.invoke("area:pick-complete", result),
  openShortcut: (shortcut) => ipcRenderer.invoke("shortcut:open", shortcut),
  pickAppShortcut: () => ipcRenderer.invoke("app:pick"),
  pickShortcutImage: () => ipcRenderer.invoke("image:pick"),
  pickSpriteImage: () => ipcRenderer.invoke("sprite-image:pick"),
  setClickThrough: (ignore) => ipcRenderer.send("overlay:click-through", !!ignore),
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
