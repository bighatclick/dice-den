Pod::Spec.new do |s|
  s.name           = 'CloudKv'
  s.version        = '1.0.0'
  s.summary        = 'iCloud key-value sync for Dice Den'
  s.description    = 'Wraps NSUbiquitousKeyValueStore for settings, stats summary, unlocks and the daily streak.'
  s.author         = 'Dice Den'
  s.homepage       = 'https://dicedengame.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
