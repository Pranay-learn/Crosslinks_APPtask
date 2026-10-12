const {getDefaultConfig}=require('expo/metro-config');
const path=require('node:path');
const projectRoot=__dirname,repositoryRoot=path.resolve(projectRoot,'..');
const config=getDefaultConfig(projectRoot);
config.watchFolders=[repositoryRoot];
config.resolver.nodeModulesPaths=[path.resolve(projectRoot,'node_modules'),path.resolve(repositoryRoot,'node_modules')];
config.resolver.disableHierarchicalLookup=false;
module.exports=config;
