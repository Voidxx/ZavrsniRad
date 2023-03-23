#include <ESP8266WiFi.h>
#include <Adafruit_NeoPixel.h>
#include <EEPROM.h>
String ssid_serial;
String password_serial;
char ssid[20] = "";
char password[20] = "";
#define PIN 14
String Info = "";
String Realssid;
String Realpassword;
int isAlive;
int Max_Percentage = 100;
float Max_Percentage_float = 100;
float SecondsToRespawn;
float SecondsToRespawnStarting;
float SecondsRatio = 0;
bool countdown = false;
bool Send = true;
WiFiServer server(80);
String request;
int Health_Percent;
int Mana_Percent;
int Index;
Adafruit_NeoPixel strip = Adafruit_NeoPixel(29, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(64);
  strip.show();
label:
  loadCredentials();
  WiFi.disconnect();
  WiFi.begin(Realssid, Realpassword);
  while (WiFi.status() != WL_CONNECTED) {
    Send = true;
    Serial.println("Arduino");
    Serial.println("WifiNotOK");
    StandingBy(strip.Color(255, 0, 0));
    while (Serial.available()) {
      char aChar = Serial.read();
      Info += aChar;
      if (aChar == '\r') {
        ssid_serial = Info;
        Info = "";
      }
      if (aChar == '\n') {
        password_serial = Info;
        Info = "";
        saveCredentials();
        Send = true;
        goto label;
      }
    }
  }
  server.begin();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client = server.available();
    while (Serial.available()) {
      char aChar = Serial.read();
      Info += aChar;
      if (aChar == '\r') {
        ssid_serial = Info;
        Info = "";
      }
      if (aChar == '\n') {
        password_serial = Info;
        Info = "";
        saveCredentials();
        Send = false;
        Serial.end();
        setup();
      }
    }

    if (!client) {
      Serial.println("Arduino");
      Serial.println("WifiOK");
      if (Send == true) {
        Serial.println(WiFi.localIP());
      }
      StandingBy(strip.Color(191, 64, 191));
      return;
    }
    while (client.connected()) {
      if (client.available()) {
        strip.clear();
        char c = client.read();
        request += c;
        if (c == '\n') {
          if (request.indexOf('H') != -1) {
            Index = request.indexOf('H');
            Health_Percent = request.substring(0, Index).toInt();
            request = "";
          }
          else if (request.indexOf('M') != -1) {
            Index = request.indexOf('M');
            Mana_Percent = request.substring(0, Index).toInt();
            request = "";
          }
          else if (request.indexOf('D') != -1) {
            Index = request.indexOf('D');
            isAlive = request.substring(0, Index).toInt();
            request = "";
          }
          else if (request.indexOf('S') != -1) {
            Index = request.indexOf('S');
            SecondsToRespawn = request.substring(0, Index).toInt();
            if (countdown == false) {
              SecondsToRespawnStarting = SecondsToRespawn;
              countdown = true;
            }
            request = "";
          }
          if (isAlive == 1) {
            SecondsToRespawnStarting = 0;
            countdown = false;
            for (uint16_t i = strip.numPixels() / 2, sum = 1; i < strip.numPixels(); i++, sum++) {
              SetHealth(i, sum);
            }

            for (uint16_t i = strip.numPixels() / 2, sum = 1; i > 0; i--, sum++) {
              SetMana(i, sum);
            }
          }
          if (isAlive == 0 && SecondsToRespawn != 0 && SecondsToRespawnStarting != 0) {
            SecondsRatio = (SecondsToRespawn / SecondsToRespawnStarting) * 100;
            for (uint16_t i = 0, sum = 1; i < strip.numPixels(); i++, sum++) {
              Death(i, sum);
            }
            if (SecondsToRespawn == 0) {
              for (uint16_t i = 0; i < strip.numPixels(); i++) {
                strip.setPixelColor(i, strip.Color(169, 169, 169));
              }
            }
          }

          strip.show();

        }
      }

    }

    delay(1);
  }
  else {
    Serial.end();
    setup();
  }
}

void loadCredentials() {
  EEPROM.begin(512);
  EEPROM.get(0, ssid);
  EEPROM.get(0 + 50, password);
  EEPROM.end();
  Realssid = String(ssid);
  Realssid.trim();
  Realpassword = String(password);
  Realpassword.trim();
}
void saveCredentials() {
  EEPROM.begin(512);
  strcpy(ssid, ssid_serial.c_str());
  strcpy(password, password_serial.c_str());
  EEPROM.put(0, ssid);
  EEPROM.put(0 + 50, password);
  EEPROM.commit();
  EEPROM.end();
}

void SetHealth(uint16_t LEDnum, int sum) {
  if (Health_Percent != 0 && Health_Percent > Max_Percentage - ((Max_Percentage / (strip.numPixels() / 2))*sum) && Health_Percent <= (Max_Percentage - ((Max_Percentage / ((strip.numPixels() / 2)) * (sum - 1))))) {
    for (uint16_t i = strip.numPixels(); i > LEDnum; i--) {
      strip.setPixelColor(i, strip.Color(0, 255, 0));
    }
  }
  if (Health_Percent == 0) {
    strip.clear();
  }
}
void SetMana(uint16_t LEDnum, int sum) {
  if (Mana_Percent != 0 && Mana_Percent > Max_Percentage - ((Max_Percentage / (strip.numPixels() / 2))*sum) && Mana_Percent <= (Max_Percentage - ((Max_Percentage / (strip.numPixels() / 2)) * (sum - 1)))) {
    for (uint16_t j = 0; j < LEDnum; j++) {
      strip.setPixelColor(j, strip.Color(0, 0, 255));
    }
  }
  if (Mana_Percent == 0) {
    strip.clear();
  }
}
void Death(uint16_t LEDnum, int sum) {
  if (SecondsRatio != 0 && SecondsRatio > Max_Percentage_float - ((Max_Percentage_float / (strip.numPixels()))*sum) && SecondsRatio <= (Max_Percentage_float - ((Max_Percentage_float / (strip.numPixels())) * (sum - 1)))) {
    for (uint16_t i = 0; i < LEDnum; i++) {
      strip.setPixelColor(i, strip.Color(169, 169, 169));
    }
  }
}
void StandingBy(uint32_t color) {
  for (uint16_t i = 0; i < strip.numPixels(); i++) {
    strip.clear();
    for (uint16_t j = i; j < i + 3 && j < strip.numPixels(); j++) {
      strip.setPixelColor(j, color);
      delay(25);
    }
    strip.show();
  }
  strip.clear();
  strip.show();
}
