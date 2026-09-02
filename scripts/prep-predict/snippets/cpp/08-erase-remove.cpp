#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> values{5, 1, 4, 1, 3};
    sort(values.begin(), values.end());
    for (int v : values) cout << v;
    cout << "\n";
    auto it = lower_bound(values.begin(), values.end(), 3);
    cout << (it - values.begin()) << "\n";
    cout << (find(values.begin(), values.end(), 99) == values.end()) << "\n";
    values.erase(remove(values.begin(), values.end(), 1), values.end());
    for (int v : values) cout << v;
    cout << "\n";
    return 0;
}
