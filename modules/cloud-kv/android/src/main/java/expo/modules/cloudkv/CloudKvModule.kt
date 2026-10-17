package expo.modules.cloudkv

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android has no iCloud. Until v1.1 (Play Games Saved Games) this is a no-op;
 * Android Auto Backup already restores the saved data on a reinstall.
 */
class CloudKvModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CloudKv")
    Events("onChange")
    Function("isAvailable") { false }
    Function("getString") { _: String -> null as String? }
    Function("setString") { _: String, _: String -> }
    Function("synchronize") { false }
  }
}
