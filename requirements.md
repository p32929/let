# **App Requirements: Daily Tracking & Insight Dashboard**

## **1. Overview**

Build an app that allows users to track daily events, habits, and notes. Each event can store different types of values (boolean, number, or text). The app should display an intuitive weekly view and provide a dashboard that helps users understand correlations and overlapping patterns between events.

---

## **2. Weekly View**

* At the top of the screen, display **7 days of the current week**, with **today’s date clearly highlighted**.
* Below the weekly header, users should be able to view and manage their events for each day.

---

## **3. Event Types**

Events must support multiple data types:

### **Event Examples**

* **Sleep**

  * Type: Number
  * Unit: Hours
* **Went to school**

  * Type: Boolean (Yes/No)
* **Mood**

  * Type: String
* **Water intake**

  * Type: Number (Cups)

### **Event Configuration**

Each event includes:

* Event name
* Value type (boolean, number, string)
* Optional unit label (e.g., hours, cups)

---

## **4. Event Management**

Users must be able to:

* **Add new events**
* **Edit event names, types, and recorded values**
* **Delete events**
* **Record values for any day**

All data should be **automatically saved to a database**.

---

## **5. Tracking Interface (Widgets)**

* Provide simple, smart widgets for entering values:

  * Toggle for boolean events
  * Number input for numeric events
  * Text field for string events
* Widgets should make recording daily data fast and frictionless.

---

## **6. Dashboard & Insights**

The dashboard is a core feature.

### **6.1 Data Visualization**

Include charts/graphs that easily show:

* Trends over time
* Day-to-day comparisons
* Weekly patterns
* Overlapping event relationships

### **6.2 Correlation Insights**

The system should highlight relationships such as:

* “When I sleep 7 hours, I work on my hobby project for 5 hours.”
* “When I sleep only 3 hours, I have a bad day.”
* “Higher water intake correlates with better mood.”
* “Low exercise days overlap with high screen-time days.”

These insights should be derived using simple statistical comparisons or visual overlays.

### **6.3 Event Overlap Detection**

The dashboard must help users:

* See which events tend to occur on the same days
* Understand how one type of event influences another
* View overlapping patterns via charts, heat maps, scatter plots, or combined timelines

---

## **7. Data Storage**

* All events, values, and settings are persisted automatically.
* Database should support:

  * Dynamic events added by the user
  * Values stored by date
  * Easy querying for insights

---

## **8. Goals**

The app should help users:

* Track anything they care about
* See patterns in their life
* Understand cause-effect relationships
* Improve habits through data-driven insights
