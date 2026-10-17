import ExpoModulesCore
import Foundation

/// iCloud key-value storage (specs.md §8). Small (1 MB total), no login, no backend.
/// Needs the com.apple.developer.ubiquity-kvstore-identifier entitlement (set in app.json).
public class CloudKvModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("CloudKv")

    Events("onChange")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
        object: NSUbiquitousKeyValueStore.default,
        queue: .main
      ) { [weak self] note in
        let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        self?.sendEvent("onChange", ["keys": keys])
      }
      NSUbiquitousKeyValueStore.default.synchronize()
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
      }
    }

    Function("isAvailable") { () -> Bool in
      FileManager.default.ubiquityIdentityToken != nil
    }

    Function("getString") { (key: String) -> String? in
      NSUbiquitousKeyValueStore.default.string(forKey: key)
    }

    Function("setString") { (key: String, value: String) in
      NSUbiquitousKeyValueStore.default.set(value, forKey: key)
    }

    Function("synchronize") { () -> Bool in
      NSUbiquitousKeyValueStore.default.synchronize()
    }
  }
}
