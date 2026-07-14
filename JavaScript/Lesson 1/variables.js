const accountId = 12345
let accountEmail = "1234@gmai.com"
var accountPassword = "12345"
accountCity = "Jaipur"
let accountState;

// accountId = 2 //not allowed

accountEmail = "abc@abc.com"
accountPassword = "1212121"
accountCity = "Hyderabad"

console.log(accountId);

console.table([accountId, accountEmail, accountPassword, accountCity, accountState])

/*
Dont use var bcs of issue in 
block scope and functional scope
*/

