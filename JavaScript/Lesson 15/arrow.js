const user = {
    username: "eman",
    price: 999,

    welcomeMessage: function() {
        console.log(`${this.username} , welcome to website`);
        console.log(this);
    }

}

// user.welcomeMessage()
// user.username = "eman"
// user.welcomeMessage()

// console.log(this);

// function chai(){
//     let username = "eman"
//     console.log(this.username);
// }

// chai()

// const chai = function () {
//     let username = "eman"
//     console.log(this.username);
// }

const chai =  () => {
    let username = "eman"
    console.log(this);
}


// chai()

// const addTwo = (num1, num2) => {
//     return num1 + num2
// }

// const addTwo = (num1, num2) =>  num1 + num2

// const addTwo = (num1, num2) => ( num1 + num2 )

const addTwo = (num1, num2) => ({username: "eman"})


console.log(addTwo(3, 4))


// const myArray = [2, 5, 3, 7, 8]

// myArray.forEach()
