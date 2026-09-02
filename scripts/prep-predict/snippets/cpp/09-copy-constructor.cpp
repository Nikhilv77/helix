#include <iostream>
using namespace std;

struct Counter {
    static int made;
    int id;
    Counter() : id(++made) {}
    Counter(const Counter& other) : id(++made) { cout << "copy from " << other.id << "\n"; }
};
int Counter::made = 0;

void take(Counter c) { cout << "took " << c.id << "\n"; }

int main() {
    Counter a;
    cout << a.id << "\n";
    take(a);
    Counter b = a;
    cout << b.id << " " << Counter::made << "\n";
    return 0;
}
