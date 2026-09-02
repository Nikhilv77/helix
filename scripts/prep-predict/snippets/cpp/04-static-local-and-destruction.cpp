#include <iostream>
using namespace std;

int next_id() {
    static int id = 0;
    return ++id;
}

struct Noisy {
    string label;
    Noisy(string l) : label(l) { cout << "make " << label << "\n"; }
    ~Noisy() { cout << "drop " << label << "\n"; }
};

int main() {
    cout << next_id() << "\n";
    cout << next_id() << "\n";
    {
        Noisy a("a");
        Noisy b("b");
    }
    cout << "after\n";
    cout << next_id() << "\n";
    return 0;
}
