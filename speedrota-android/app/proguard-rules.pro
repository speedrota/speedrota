-keep class br.com.speedrota.data.model.** { *; }
-keepclassmembers class br.com.speedrota.data.model.** { *; }

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature
-keepattributes Exceptions

# OkHttp
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }
-dontwarn okio.**

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class br.com.speedrota.**$$serializer { *; }
-keepclassmembers class br.com.speedrota.** {
    *** Companion;
}
-keepclasseswithmembers class br.com.speedrota.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Google Maps
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }

# ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
