const url = 'https://www.youthcenter.go.kr/go/ythip/getPlcy?apiKeyNm=fd292de7-a018-4a1e-9d97-08d28e35a3d4&pageNum=1&pageSize=2&rtnType=json';
const res = await fetch(url);
const data = await res.json();
console.log(JSON.stringify(data, null, 2));