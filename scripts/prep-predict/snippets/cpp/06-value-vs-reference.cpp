#include <iostream>
#include <vector>
using namespace std;

void addOne(vector<int> copy) { copy.push_back(1); }
void addTwo(vector<int>& ref) { ref.push_back(2); }

int main() {
    vector<int> values;
    addOne(values);
    cout << values.size() << "\n";
    addTwo(values);
    cout << values.size() << "\n";
    vector<int> other = values;
    other.push_back(3);
    cout << values.size() << " " << other.size() << "\n";
    return 0;
}
