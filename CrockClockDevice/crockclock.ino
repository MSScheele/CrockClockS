int servoPin = D3;

const int queueSize = 5;
int* scheduleQueue[queueSize];
int scheduledEvents = 0;

Servo buttonServo;
const int servoZeroPos = 5;
const int servoPushPos = 60;

const String onlineEvent = "ccs-online";
const String completeEvent = "ccs-complete";

//Settings: 0: Warm, 1: High 4h 2: High 6h 3: Low 6h 4: Low 8h
const int stateCount = 5;
int potState = 0; //Note: Starts in off, but warm is +5 from there
bool isOff = true;

void setup() {
    for(int i=0;i<queueSize;i++) {
       scheduleQueue[i] = NULL; //initialize memory
    }
    
    pinMode(servoPin, OUTPUT);
    buttonServo.attach(servoPin);
    buttonServo.write(servoZeroPos); //Move to one end of actuation range
    
    Particle.function("regEvent", scheduleEvent);
    Particle.function("keepAlive", keepAlive);
    Particle.publish(onlineEvent);
}

void loop() {
    //If multiple events need to fire, this loop will do them in order, one per cycle
    if(scheduledEvents > 0 && scheduleQueue[0][0] < Time.now()) {
        fireEvent(); //TODO: Failure handling
    }
    delay(1000); //Avoid busy wait
}

int scheduleEvent(String data) {
    //Data structure: {time}|{action}|{id}
    int split1 = data.indexOf("|");
    int split2 = data.indexOf("|", split1+1);
    
    if(split1>=0 && split2>split1) {
        int* newEvent = (int*) calloc(3, sizeof(int));
        newEvent[0] = data.substring(0, split1).toInt();
        newEvent[1] = data.substring(split1+1,split2).toInt();
        newEvent[2] = data.substring(split2+1).toInt();
    
        int insertAt = 0;
        for(int i=0;i<scheduledEvents;i++) {
            if(newEvent[0]>scheduleQueue[i][0]) {
                insertAt++;
            } else {
                i = queueSize+1; //break
            }
        }
        insertEventInQueue(newEvent, insertAt);
    }
    return 1;
}

int keepAlive(String data) {
    return 1;
}

void insertEventInQueue(int* event, int insertAt) {
    //Item at end gets dropped. Not implementing any fancy extension stuff for this.
    for(int i=insertAt;i<queueSize-1;i++) {
     scheduleQueue[i+1] = scheduleQueue[i];
    }
    scheduleQueue[insertAt] = event;
    
    if(scheduledEvents < queueSize) {
        scheduledEvents++; //We know we didn't remove something, so the number scheduled increased
    }
}

void fireEvent() {
    int newState = scheduleQueue[0][1]; //Read new state for device
    int eventId = scheduleQueue[0][2];
    int stateOffset = (stateCount + newState - potState) % stateCount; //Add state count to coerce result into ring
    if(newState == 0 && isOff) {
        stateOffset = stateCount;
    }
    for(int i=0;i<stateOffset;i++) {
        pressButton();
    }
    potState = newState;
    removeEventFromQueue(0);
    
    Particle.publish(completeEvent, String(eventId));
}

void removeEventFromQueue(int removeIndex) {
    for(int i=removeIndex;i<queueSize-1;i++) {
      scheduleQueue[i] = scheduleQueue[i+1];
    }
    scheduleQueue[queueSize-1] = NULL;
    scheduledEvents--; //We always reduce number of queued events
}

void pressButton() {
    isOff = false;
    //Delay for actuation
    buttonServo.write(servoPushPos);
    delay(500);
    buttonServo.write(servoZeroPos);
    delay(500);
}