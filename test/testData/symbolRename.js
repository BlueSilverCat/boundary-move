function func1(dataObj) {
  console.log(dataObj.data);
  return dataObj.data + 10;
}

const data = { data: 1 };
func1(data);
