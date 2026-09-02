#include <iostream>
using namespace std;

struct Base {
    virtual string name() const { return "Base"; }
    string plain() const { return "Base"; }
    virtual ~Base() = default;
};
struct Derived : Base {
    string name() const override { return "Derived"; }
    string plain() const { return "Derived"; }
};

void byValue(Base b) { cout << b.name() << "\n"; }
void byRef(const Base& b) { cout << b.name() << "\n"; }

int main() {
    Derived d;
    Base* p = &d;
    cout << p->name() << "\n";
    cout << p->plain() << "\n";
    byValue(d);
    byRef(d);
    return 0;
}
