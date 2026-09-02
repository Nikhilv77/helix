#include <iostream>
#include <map>
using namespace std;

int main() {
    map<string, int> counts;
    cout << counts.size() << "\n";
    cout << counts["missing"] << "\n";
    cout << counts.size() << "\n";
    cout << counts.count("other") << "\n";
    cout << counts.size() << "\n";
    return 0;
}
