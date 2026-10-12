import type {ExpoConfig} from 'expo/config';
export default {name:'NSUT Connect',slug:'nsut-connect-mobile',version:'1.0.0',scheme:'nsutconnect',orientation:'portrait',userInterfaceStyle:'automatic',
ios:{bundleIdentifier:'in.ac.nsut.connect',supportsTablet:true},android:{package:'in.ac.nsut.connect',...(process.env.GOOGLE_SERVICES_JSON?{googleServicesFile:process.env.GOOGLE_SERVICES_JSON}:{})},
web:{bundler:'metro',output:'single'},plugins:['expo-secure-store','expo-sqlite',['expo-notifications',{defaultChannel:'campus'}],['expo-image-picker',{photosPermission:'Choose an image for your profile or campus post.'}]],
experiments:{baseUrl:process.env.EXPO_PUBLIC_BASE_PATH||''},extra:{eas:{projectId:process.env.EXPO_PUBLIC_EAS_PROJECT_ID||''}}} satisfies ExpoConfig;
