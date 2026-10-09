<template>
  <div :class="$style.asideLogo">
    <span :class="$style.headerLogo" aria-label="LX Music+" />
    <span :class="$style.name">LX Music+</span>
  </div>
</template>

<style lang="less" module>
// Ported from Any Listen: components/layout/Aside/Logo.svelte
// (the "Any Listen" wordmark is replaced by the same mark + "LX Music")
.asideLogo {
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
  align-items: flex-end;
  padding: 16px 20px;
  color: var(--color-primary-dark-100-alpha-200);
  -webkit-app-region: drag;
  svg {
    filter: drop-shadow(0 0 4px rgb(0 0 0 / 16%));
  }
}
.headerLogo {
  flex: none;
  width: 21px;
  height: 21px;
  background-color: var(--color-primary-font);
  -webkit-mask-image: url('../../../../static/images/tray/tray_origin@2x.png');
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-image: url('../../../../static/images/tray/tray_origin@2x.png');
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
}
.name {
  font-size: 22px;
  font-style: italic;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  filter: drop-shadow(0 0 4px rgb(0 0 0 / 16%));
}
</style>
