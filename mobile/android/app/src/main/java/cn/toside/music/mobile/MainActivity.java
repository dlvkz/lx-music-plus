package cn.toside.music.mobile;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.annotation.Nullable;

import com.reactnativenavigation.NavigationActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends NavigationActivity {

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    layoutBehindNavigationBar();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) layoutBehindNavigationBar();
  }

  // The app draws behind the system navigation bar: the bar is transparent and each page
  // decides what is shown under it (see NavBarSpacer in src/components/PageContent.tsx)
  private void layoutBehindNavigationBar() {
    Window window = getWindow();
    View decorView = window.getDecorView();
    decorView.setSystemUiVisibility(decorView.getSystemUiVisibility()
      | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    window.setNavigationBarColor(Color.TRANSPARENT);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.setNavigationBarContrastEnforced(false);
  }

}
