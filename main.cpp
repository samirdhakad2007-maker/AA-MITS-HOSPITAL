#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace std;

struct Patient {
    int id;
    string name, age, gender, phone, address;
};

struct Doctor {
    int id;
    string name, specialization, phone;
};

struct Appointment {
    int id, patientId, doctorId;
    string date, time, status;
};

struct Bed {
    int id;
    string ward, bedNumber, status;
};

struct Bill {
    int id, patientId;
    double amount;
    string description, status;
};

struct Medicine {
    int id;
    string name, category;
    int quantity;
    double unitPrice;
};

struct MedicalRecord {
    int id, patientId, doctorId;
    string diagnosis, prescription, date;
};

struct Staff {
    int id;
    string name, role, department, phone;
};

vector<Patient> patients;
vector<Doctor> doctors;
vector<Appointment> appointments;
vector<Bed> beds;
vector<Bill> bills;
vector<Medicine> medicines;
vector<MedicalRecord> records;
vector<Staff> staff;

string escapeField(const string& value) {
    string result;
    for (char c : value) {
        if (c == '|') result += "\\|";
        else if (c == '\\') result += "\\\\";
        else result += c;
    }
    return result;
}

string readInput(const string& prompt) {
    cout << prompt;
    string value;
    getline(cin, value);
    return value;
}

int readInt(const string& prompt) {
    while (true) {
        cout << prompt;
        string value;
        getline(cin, value);
        try {
            return stoi(value);
        } catch (...) {
            cout << "Invalid number. Try again.\n";
        }
    }
}

double readDouble(const string& prompt) {
    while (true) {
        cout << prompt;
        string value;
        getline(cin, value);
        try {
            return stod(value);
        } catch (...) {
            cout << "Invalid amount. Try again.\n";
        }
    }
}

template <typename T>
int nextId(const vector<T>& items, int T::* id) {
    int value = 0;
    for (const T& item : items) value = max(value, item.*id);
    return value + 1;
}

int nextPatientId() {
    int value = 0;
    for (const auto& item : patients) value = max(value, item.id);
    return value + 1;
}
int nextDoctorId() {
    int value = 0;
    for (const auto& item : doctors) value = max(value, item.id);
    return value + 1;
}
int nextAppointmentId() {
    int value = 0;
    for (const auto& item : appointments) value = max(value, item.id);
    return value + 1;
}
int nextBedId() {
    int value = 0;
    for (const auto& item : beds) value = max(value, item.id);
    return value + 1;
}
int nextBillId() {
    int value = 0;
    for (const auto& item : bills) value = max(value, item.id);
    return value + 1;
}
int nextMedicineId() {
    int value = 0;
    for (const auto& item : medicines) value = max(value, item.id);
    return value + 1;
}
int nextRecordId() {
    int value = 0;
    for (const auto& item : records) value = max(value, item.id);
    return value + 1;
}
int nextStaffId() {
    int value = 0;
    for (const auto& item : staff) value = max(value, item.id);
    return value + 1;
}

template <typename T>
void removeById(vector<T>& items, int id, int T::* idField) {
    items.erase(remove_if(items.begin(), items.end(),
                          [id, idField](const T& item) { return item.*idField == id; }),
                items.end());
}

void saveAll() {
    ofstream f("hospital_data.txt");
    if (!f) return;
    f << "[PATIENTS]\n";
    for (const auto& p : patients)
        f << p.id << '|' << escapeField(p.name) << '|' << escapeField(p.age) << '|'
          << escapeField(p.gender) << '|' << escapeField(p.phone) << '|'
          << escapeField(p.address) << '\n';
    f << "[DOCTORS]\n";
    for (const auto& d : doctors)
        f << d.id << '|' << escapeField(d.name) << '|' << escapeField(d.specialization)
          << '|' << escapeField(d.phone) << '\n';
    f << "[APPOINTMENTS]\n";
    for (const auto& a : appointments)
        f << a.id << '|' << a.patientId << '|' << a.doctorId << '|' << escapeField(a.date)
          << '|' << escapeField(a.time) << '|' << escapeField(a.status) << '\n';
    f << "[BEDS]\n";
    for (const auto& b : beds)
        f << b.id << '|' << escapeField(b.ward) << '|' << escapeField(b.bedNumber)
          << '|' << escapeField(b.status) << '\n';
    f << "[BILLS]\n";
    for (const auto& b : bills)
        f << b.id << '|' << b.patientId << '|' << fixed << setprecision(2) << b.amount
          << '|' << escapeField(b.description) << '|' << escapeField(b.status) << '\n';
    f << "[MEDICINES]\n";
    for (const auto& m : medicines)
        f << m.id << '|' << escapeField(m.name) << '|' << escapeField(m.category) << '|'
          << m.quantity << '|' << fixed << setprecision(2) << m.unitPrice << '\n';
    f << "[RECORDS]\n";
    for (const auto& r : records)
        f << r.id << '|' << r.patientId << '|' << r.doctorId << '|' << escapeField(r.diagnosis)
          << '|' << escapeField(r.prescription) << '|' << escapeField(r.date) << '\n';
    f << "[STAFF]\n";
    for (const auto& s : staff)
        f << s.id << '|' << escapeField(s.name) << '|' << escapeField(s.role) << '|'
          << escapeField(s.department) << '|' << escapeField(s.phone) << '\n';
}

vector<string> splitFields(const string& line) {
    vector<string> fields;
    string field;
    bool escaped = false;
    for (char c : line) {
        if (escaped) {
            field += c;
            escaped = false;
        } else if (c == '\\') {
            escaped = true;
        } else if (c == '|') {
            fields.push_back(field);
            field.clear();
        } else {
            field += c;
        }
    }
    fields.push_back(field);
    return fields;
}

void loadAll() {
    ifstream f("hospital_data.txt");
    if (!f) return;
    string section, line;
    while (getline(f, line)) {
        if (!line.empty() && line.front() == '[') {
            section = line;
            continue;
        }
        auto v = splitFields(line);
        try {
            if (section == "[PATIENTS]" && v.size() >= 6)
                patients.push_back({stoi(v[0]), v[1], v[2], v[3], v[4], v[5]});
            else if (section == "[DOCTORS]" && v.size() >= 4)
                doctors.push_back({stoi(v[0]), v[1], v[2], v[3]});
            else if (section == "[APPOINTMENTS]" && v.size() >= 6)
                appointments.push_back({stoi(v[0]), stoi(v[1]), stoi(v[2]), v[3], v[4], v[5]});
            else if (section == "[BEDS]" && v.size() >= 4)
                beds.push_back({stoi(v[0]), v[1], v[2], v[3]});
            else if (section == "[BILLS]" && v.size() >= 5)
                bills.push_back({stoi(v[0]), stoi(v[1]), stod(v[2]), v[3], v[4]});
            else if (section == "[MEDICINES]" && v.size() >= 5)
                medicines.push_back({stoi(v[0]), v[1], v[2], stoi(v[3]), stod(v[4])});
            else if (section == "[RECORDS]" && v.size() >= 6)
                records.push_back({stoi(v[0]), stoi(v[1]), stoi(v[2]), v[3], v[4], v[5]});
            else if (section == "[STAFF]" && v.size() >= 5)
                staff.push_back({stoi(v[0]), v[1], v[2], v[3], v[4]});
        } catch (...) {
        }
    }
}

bool patientExists(int id) {
    return any_of(patients.begin(), patients.end(), [id](const Patient& p) { return p.id == id; });
}
bool doctorExists(int id) {
    return any_of(doctors.begin(), doctors.end(), [id](const Doctor& d) { return d.id == id; });
}

void patientMenu();
void doctorMenu();
void appointmentMenu();
void bedMenu();
void billingMenu();
void inventoryMenu();
void recordMenu();
void staffMenu();

void addPatient() {
    Patient p{nextPatientId(), "", "", "", "", ""};
    p.name = readInput("Name: ");
    p.age = readInput("Age: ");
    p.gender = readInput("Gender: ");
    p.phone = readInput("Phone: ");
    p.address = readInput("Address: ");
    patients.push_back(p);
    cout << "Patient added. ID: " << p.id << "\n";
}

void listPatients() {
    cout << "\n--- Patients ---\n";
    for (const auto& p : patients)
        cout << p.id << " | " << p.name << " | Age " << p.age << " | " << p.gender
             << " | " << p.phone << " | " << p.address << "\n";
    if (patients.empty()) cout << "No patients found.\n";
}

void patientMenu() {
    while (true) {
        cout << "\nPATIENT MANAGEMENT\n1. Add\n2. List/Search\n3. Delete\n4. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") addPatient();
        else if (choice == "2") {
            listPatients();
            string query = readInput("Search name/phone (leave blank to skip): ");
            if (!query.empty())
                for (const auto& p : patients)
                    if (p.name.find(query) != string::npos || p.phone.find(query) != string::npos)
                        cout << p.id << " | " << p.name << " | " << p.phone << "\n";
        } else if (choice == "3") {
            int id = readInt("Patient ID to delete: ");
            removeById(patients, id, &Patient::id);
            cout << "Deleted if an ID matched.\n";
        } else if (choice == "4") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void doctorMenu() {
    while (true) {
        cout << "\nDOCTOR MANAGEMENT\n1. Add\n2. List\n3. Delete\n4. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            Doctor d{nextDoctorId(), "", "", ""};
            d.name = readInput("Name: ");
            d.specialization = readInput("Specialization: ");
            d.phone = readInput("Phone: ");
            doctors.push_back(d);
            cout << "Doctor added. ID: " << d.id << "\n";
        } else if (choice == "2") {
            cout << "\n--- Doctors ---\n";
            for (const auto& d : doctors)
                cout << d.id << " | " << d.name << " | " << d.specialization << " | " << d.phone << "\n";
            if (doctors.empty()) cout << "No doctors found.\n";
        } else if (choice == "3") {
            int id = readInt("Doctor ID to delete: ");
            removeById(doctors, id, &Doctor::id);
        } else if (choice == "4") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void appointmentMenu() {
    while (true) {
        cout << "\nAPPOINTMENTS\n1. Schedule\n2. List\n3. Change Status\n4. Cancel/Delete\n5. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            int patientId = readInt("Patient ID: ");
            int doctorId = readInt("Doctor ID: ");
            if (!patientExists(patientId) || !doctorExists(doctorId)) {
                cout << "Patient or doctor does not exist.\n";
            } else {
                appointments.push_back({nextAppointmentId(), patientId, doctorId,
                                        readInput("Date (YYYY-MM-DD): "),
                                        readInput("Time (HH:MM): "), "Scheduled"});
                cout << "Appointment scheduled.\n";
            }
        } else if (choice == "2") {
            cout << "\n--- Appointments ---\n";
            for (const auto& a : appointments)
                cout << a.id << " | Patient " << a.patientId << " | Doctor " << a.doctorId
                     << " | " << a.date << " " << a.time << " | " << a.status << "\n";
            if (appointments.empty()) cout << "No appointments found.\n";
        } else if (choice == "3") {
            int id = readInt("Appointment ID: ");
            bool found = false;
            for (auto& a : appointments)
                if (a.id == id) {
                    a.status = readInput("Status (Scheduled/Completed/Cancelled): ");
                    found = true;
                }
            cout << (found ? "Status updated.\n" : "Appointment not found.\n");
        } else if (choice == "4") {
            int id = readInt("Appointment ID to delete: ");
            removeById(appointments, id, &Appointment::id);
        } else if (choice == "5") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void bedMenu() {
    while (true) {
        cout << "\nROOM/BED MANAGEMENT\n1. Add Bed\n2. List Beds\n3. Change Status\n4. Delete Bed\n5. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            beds.push_back({nextBedId(), readInput("Ward: "), readInput("Bed number: "), "Available"});
            cout << "Bed added.\n";
        } else if (choice == "2") {
            cout << "\n--- Beds ---\n";
            for (const auto& b : beds)
                cout << b.id << " | " << b.ward << " | Bed " << b.bedNumber << " | " << b.status << "\n";
            if (beds.empty()) cout << "No beds found.\n";
        } else if (choice == "3") {
            int id = readInt("Bed ID: ");
            bool found = false;
            for (auto& b : beds)
                if (b.id == id) {
                    b.status = readInput("Status (Available/Occupied/Cleaning): ");
                    found = true;
                }
            cout << (found ? "Status updated.\n" : "Bed not found.\n");
        } else if (choice == "4") {
            int id = readInt("Bed ID to delete: ");
            removeById(beds, id, &Bed::id);
        } else if (choice == "5") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void billingMenu() {
    while (true) {
        cout << "\nBILLING\n1. Create Bill\n2. List Bills\n3. Mark Paid\n4. Delete Bill\n5. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            int patientId = readInt("Patient ID: ");
            if (!patientExists(patientId)) cout << "Patient does not exist.\n";
            else {
                bills.push_back({nextBillId(), patientId, readDouble("Amount: "),
                                 readInput("Description: "), "Unpaid"});
                cout << "Bill created.\n";
            }
        } else if (choice == "2") {
            cout << "\n--- Bills ---\n";
            for (const auto& b : bills)
                cout << b.id << " | Patient " << b.patientId << " | " << b.description
                     << " | Rs " << fixed << setprecision(2) << b.amount << " | " << b.status << "\n";
            if (bills.empty()) cout << "No bills found.\n";
        } else if (choice == "3") {
            int id = readInt("Bill ID: ");
            bool found = false;
            for (auto& b : bills)
                if (b.id == id) {
                    b.status = "Paid";
                    found = true;
                }
            cout << (found ? "Payment recorded.\n" : "Bill not found.\n");
        } else if (choice == "4") {
            int id = readInt("Bill ID to delete: ");
            removeById(bills, id, &Bill::id);
        } else if (choice == "5") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void inventoryMenu() {
    while (true) {
        cout << "\nINVENTORY/PHARMACY\n1. Add Medicine\n2. List Medicines\n3. Update Stock\n4. Delete Medicine\n5. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            Medicine m{nextMedicineId(), "", "", 0, 0};
            m.name = readInput("Medicine name: ");
            m.category = readInput("Category: ");
            m.quantity = readInt("Initial quantity: ");
            m.unitPrice = readDouble("Unit price: ");
            medicines.push_back(m);
            cout << "Medicine added.\n";
        } else if (choice == "2") {
            cout << "\n--- Inventory ---\n";
            for (const auto& m : medicines)
                cout << m.id << " | " << m.name << " | " << m.category << " | Qty "
                     << m.quantity << " | Rs " << fixed << setprecision(2) << m.unitPrice << "\n";
            if (medicines.empty()) cout << "No medicines found.\n";
        } else if (choice == "3") {
            int id = readInt("Medicine ID: ");
            bool found = false;
            for (auto& m : medicines)
                if (m.id == id) {
                    m.quantity = readInt("New quantity: ");
                    found = true;
                }
            cout << (found ? "Stock updated.\n" : "Medicine not found.\n");
        } else if (choice == "4") {
            int id = readInt("Medicine ID to delete: ");
            removeById(medicines, id, &Medicine::id);
        } else if (choice == "5") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void recordMenu() {
    while (true) {
        cout << "\nMEDICAL RECORDS\n1. Add Record\n2. List Records\n3. Delete Record\n4. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            int patientId = readInt("Patient ID: ");
            int doctorId = readInt("Doctor ID: ");
            if (!patientExists(patientId) || !doctorExists(doctorId))
                cout << "Patient or doctor does not exist.\n";
            else {
                records.push_back({nextRecordId(), patientId, doctorId,
                                   readInput("Diagnosis: "), readInput("Prescription: "),
                                   readInput("Date (YYYY-MM-DD): ")});
                cout << "Record added.\n";
            }
        } else if (choice == "2") {
            cout << "\n--- Medical Records ---\n";
            for (const auto& r : records)
                cout << r.id << " | Patient " << r.patientId << " | Doctor " << r.doctorId
                     << " | " << r.date << " | " << r.diagnosis << " | Rx: " << r.prescription << "\n";
            if (records.empty()) cout << "No records found.\n";
        } else if (choice == "3") {
            int id = readInt("Record ID to delete: ");
            removeById(records, id, &MedicalRecord::id);
        } else if (choice == "4") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

void staffMenu() {
    while (true) {
        cout << "\nSTAFF MANAGEMENT\n1. Add Staff\n2. List Staff\n3. Delete Staff\n4. Back\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") {
            Staff s{nextStaffId(), "", "", "", ""};
            s.name = readInput("Name: ");
            s.role = readInput("Role: ");
            s.department = readInput("Department: ");
            s.phone = readInput("Phone: ");
            staff.push_back(s);
            cout << "Staff added.\n";
        } else if (choice == "2") {
            cout << "\n--- Staff ---\n";
            for (const auto& s : staff)
                cout << s.id << " | " << s.name << " | " << s.role << " | "
                     << s.department << " | " << s.phone << "\n";
            if (staff.empty()) cout << "No staff found.\n";
        } else if (choice == "3") {
            int id = readInt("Staff ID to delete: ");
            removeById(staff, id, &Staff::id);
        } else if (choice == "4") break;
        else cout << "Invalid choice.\n";
        saveAll();
    }
}

int main() {
    loadAll();
    cout << "========================================\n";
    cout << "     HOSPITAL MANAGEMENT SYSTEM\n";
    cout << "========================================\n";

    while (true) {
        cout << "\nMAIN MENU\n"
             << "1. Patients\n"
             << "2. Doctors\n"
             << "3. Appointments\n"
             << "4. Rooms/Beds\n"
             << "5. Billing\n"
             << "6. Inventory/Pharmacy\n"
             << "7. Medical Records\n"
             << "8. Staff\n"
             << "9. Exit\nChoice: ";
        string choice;
        getline(cin, choice);
        if (choice == "1") patientMenu();
        else if (choice == "2") doctorMenu();
        else if (choice == "3") appointmentMenu();
        else if (choice == "4") bedMenu();
        else if (choice == "5") billingMenu();
        else if (choice == "6") inventoryMenu();
        else if (choice == "7") recordMenu();
        else if (choice == "8") staffMenu();
        else if (choice == "9") {
            saveAll();
            cout << "Data saved. Goodbye.\n";
            break;
        } else cout << "Invalid choice.\n";
    }
    return 0;
}
