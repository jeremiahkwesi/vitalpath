import { Client, Account, ID } from 'react-native-appwrite';

const client = new Client()
    .setProject('67f14eae00351844c453')
    .setPlatform('com.anonymous.VitalPath');

const account = new Account(client);

export { client, account, ID }; 