const int touchPins[] = {
  4,   
  13,  
  12,  
  14,  
  27,  
  32,  
  33,  
  15,  
  2    
};

const int N = sizeof(touchPins) / sizeof(touchPins[0]);

int baseline[N];
int threshold[N];

const int CAL_TIME_MS = 2000;
const int CAL_DELAY_MS = 20;
const int MARGIN = 15;      
const int STABLE_MS = 120;     
const int COOLDOWN_MS = 500;   

unsigned long stableSince = 0;
unsigned long lastTrigger = 0;
uint16_t lastMask = 0;

struct Entry {
  uint16_t mask;
  const char* text;
};

Entry mapTable[] = {
  {12,  "I LOVE YOU"},    // 12,14
  {480, "MORE"},          // 32,33,15,2
  {96, "SPACE"},          // 32,33
  {62,  "A"},             // 27,14,12,13,32
  {1,   "B"},             // 4
  {64,  "D"},             // 33
  {30,  "E"},             // 12,13,14,27
  {32,  "F"},             // 32  
  {60,  "G"},             // 12,14,27,32
  {152, "H"},             // 14,27,15
  {78,  "I"},             // 14,12,13,33
  {24,  "K"},             // 14,27
  {28,  "L"},             // 12,14,27
  {272, "M"},             // 27,2
  {408, "N"},             // 14,27,15,2
  {184, "R"},             // 14,27,32,15
  {126, "S"},             // 12,13,14,27,32,33
  {92,  "T"},             // 12,27,14,33
  {17,  "W"},             // 27,4
  {14,  "Y"}              // 12,13,14
};

const int MAP_N = sizeof(mapTable) / sizeof(mapTable[0]);

void calibrate() {
  for (int i = 0; i < N; i++) baseline[i] = 0;

  unsigned long start = millis();
  int count = 0;
  while (millis() - start < CAL_TIME_MS) {
    for (int i = 0; i < N; i++) {
      baseline[i] += touchRead(touchPins[i]);
    }
    count++;
    delay(CAL_DELAY_MS);
  }

  for (int i = 0; i < N; i++) {
    baseline[i] /= count;
    threshold[i] = baseline[i] - MARGIN;
  }
}

uint16_t readMask() {
  uint16_t mask = 0;
  for (int i = 0; i < N; i++) {
    int v = touchRead(touchPins[i]);
    if (v < threshold[i]) mask |= (1 << i);
  }
  return mask;
}

const char* lookup(uint16_t mask) {
  for (int i = 0; i < MAP_N; i++) {
    if (mapTable[i].mask == mask) return mapTable[i].text;
  }
  return nullptr;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("don't touch pads");
  calibrate();

  Serial.println("ready now");
}

void loop() {
  uint16_t mask = readMask();

  if (mask != lastMask) {
    lastMask = mask;
    stableSince = millis();
  }

  if ((millis() - stableSince) > STABLE_MS &&
      (millis() - lastTrigger) > COOLDOWN_MS) {

    const char* out = lookup(mask);
    if (out) {
      Serial.println(out);
      lastTrigger = millis();
    }
  }

  delay(20);
}


